import { useEffect, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useQuery } from "@tanstack/react-query";

import { listDiagnosticSubmissions } from "@/modules/diagnostic/admin-repository";
import { productLeadsRepository } from "@/modules/platform/leads/repository";
import { referralRepository } from "@/modules/referrals/repository";
import { useToast } from "@/shared/components/feedback/toast";
import { useAppState } from "@/shared/state/app-state-context";

export type GrowthAlert = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  href: string;
  kind: "diagnostic" | "referral" | "product_lead" | "crm_lead";
};

const sevenDaysAgo = () =>
  Date.now() - 7 * 24 * 60 * 60 * 1000;

export function useEsadsGrowthAlerts() {
  const {
    organizationId,
    baseOrganizationId,
    isPlatformAdmin,
  } = useAppState();

  const { notify } = useToast();

  const enabled =
    isPlatformAdmin &&
    Boolean(organizationId) &&
    organizationId === baseOrganizationId;

  const query = useQuery({
    queryKey: [
      "notifications",
      "esads-growth",
      organizationId,
    ],
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    queryFn: async (): Promise<GrowthAlert[]> => {
      const [diagnostics, referrals, leads, crmLeads] =
        await Promise.all([
          listDiagnosticSubmissions(),
          referralRepository.platform(),
          productLeadsRepository.page({
            query: "",
            status: "",
            source: "",
            campaign: "",
            period: "7",
            sort: "updated",
            page: 1,
            pageSize: 20,
          }),
          supabase ? supabase.from("opportunities").select("id,title,company_id,created_at").eq("organization_id",organizationId).is("deleted_at",null).gte("created_at",new Date(sevenDaysAgo()).toISOString()).order("created_at",{ascending:false}).limit(40) : Promise.resolve({data:[],error:null}),
        ]);

      if (crmLeads.error) throw crmLeads.error;
      const cutoff = sevenDaysAgo();

      const diagnosticAlerts: GrowthAlert[] =
        diagnostics
          .filter(
            (item) =>
              new Date(item.completedAt).getTime() >=
              cutoff,
          )
          .slice(0, 20)
          .map((item) => ({
            id: `diagnostic:${item.id}`,
            title: "Novo lead do diagnóstico no CRM",
            description: `${item.businessName} · ${item.name} · Score ${item.totalScore}/100`,
            createdAt: item.completedAt,
            href: item.companyId ? `/crm/companies/${item.companyId}` : "/marketing/diagnosticos",
            kind: "diagnostic" as const,
          }));

      const referralAlerts: GrowthAlert[] =
        referrals.items
          .filter(
            (item) =>
              new Date(item.createdAt).getTime() >=
              cutoff,
          )
          .slice(0, 20)
          .map((item) => ({
            id: `referral:${item.id}:${item.status}`,
            title:
              item.status === "lead"
                ? "Nova indicação recebida"
                : "Indicação atualizada",
            description: `${item.referredName} · ${item.status}`,
            createdAt: item.createdAt,
            href: "/plataforma/indicacoes",
            kind: "referral" as const,
          }));

      const productLeadAlerts: GrowthAlert[] =
        leads.items
          .filter((lead) =>
            [
              "new",
              "contacted",
              "conversation",
              "meeting",
            ].includes(lead.status),
          )
          .map((lead) => ({
            id: `product-lead:${lead.id}:${lead.status}:${lead.updatedAt}`,
            title:
              lead.status === "new"
                ? "Novo lead interessado"
                : lead.status === "meeting"
                  ? "Lead avançou para reunião"
                  : lead.status === "conversation"
                    ? "Lead está em conversa"
                    : "Lead teve nova ação",
            description: `${lead.name} · ${lead.businessName}`,
            createdAt: lead.updatedAt,
            href: "/plataforma/leads",
            kind: "product_lead" as const,
          }));

      const diagnosticOpportunityIds = new Set(diagnostics.map(item=>item.opportunityId).filter(Boolean));
      const crmAlerts: GrowthAlert[] = (crmLeads.data??[])
        .filter(item=>!diagnosticOpportunityIds.has(item.id))
        .map(item=>({
          id:`crm-lead:${item.id}`,
          title:"Novo lead no CRM",
          description:item.title || "Nova oportunidade cadastrada",
          createdAt:item.created_at,
          href:`/crm/companies/${item.company_id}`,
          kind:"crm_lead" as const,
        }));
      return [
        ...crmAlerts,
        ...diagnosticAlerts,
        ...referralAlerts,
        ...productLeadAlerts,
      ]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() -
            new Date(a.createdAt).getTime(),
        )
        .slice(0, 20);
    },
  });

  const alerts = useMemo(
    () => query.data ?? [],
    [query.data],
  );

  useEffect(() => {
    if (!enabled || !query.isSuccess) return;

    const now = Date.now();
    const freshnessWindow = 2 * 60 * 1000;

    for (const alert of alerts) {
      const createdAt =
        new Date(alert.createdAt).getTime();

      if (
        Number.isNaN(createdAt) ||
        now - createdAt > freshnessWindow
      ) {
        continue;
      }

      const key =
        `esads-growth-alert-seen:${alert.id}`;

      if (
        localStorage.getItem(key) === "1"
      ) {
        continue;
      }

      localStorage.setItem(key, "1");

      notify({
        title: alert.title,
        description: alert.description,
      });
    }
  }, [
    alerts,
    enabled,
    notify,
    query.isSuccess,
  ]);

  return {
    ...query,
    alerts,
  };
}
