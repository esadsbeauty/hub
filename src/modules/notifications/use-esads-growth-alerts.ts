import { useEffect, useMemo } from "react";
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
  kind: "diagnostic" | "referral" | "product_lead";
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
      const [diagnostics, referrals, leads] =
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
        ]);

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
            title: "Novo diagnóstico preenchido",
            description: `${item.businessName} · ${item.name} · Score ${item.totalScore}/100`,
            createdAt: item.completedAt,
            href: "/marketing/diagnosticos",
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

      return [
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
