import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useAppState } from "@/shared/state/app-state-context";
import { useOrganizationFeature } from "@/shared/features/use-organization-feature";

export type ProspectingDashboardSummary = {
  lists: number;
  leads: number;
  contacted: number;
  engaged: number;
  opportunities: number;
};

export function useProspectingDashboardSummary() {
  const { organizationId } = useAppState();
  const feature = useOrganizationFeature("prospecting_agent");

  return useQuery({
    queryKey: [
      "dashboard",
      "prospecting-summary",
      organizationId,
    ],
    enabled:
      feature.data === true &&
      Boolean(organizationId) &&
      Boolean(supabase),
    queryFn: async (): Promise<ProspectingDashboardSummary> => {
      if (!supabase) {
        return {
          lists: 0,
          leads: 0,
          contacted: 0,
          engaged: 0,
          opportunities: 0,
        };
      }

      const [
        listsResult,
        leadsResult,
        contactedResult,
        engagedResult,
        opportunitiesResult,
      ] = await Promise.all([
        supabase
          .from("prospecting_lists")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "organization_id",
            organizationId,
          ),

        supabase
          .from("prospecting_leads")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "organization_id",
            organizationId,
          ),

        supabase
          .from("prospecting_leads")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "organization_id",
            organizationId,
          )
          .in("status", [
            "message_sent",
            "replied",
            "in_conversation",
            "opportunity",
          ]),

        supabase
          .from("prospecting_leads")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "organization_id",
            organizationId,
          )
          .in("status", [
            "replied",
            "in_conversation",
            "opportunity",
          ]),

        supabase
          .from("prospecting_leads")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq(
            "organization_id",
            organizationId,
          )
          .eq(
            "status",
            "opportunity",
          ),
      ]);

      const firstError =
        listsResult.error ??
        leadsResult.error ??
        contactedResult.error ??
        engagedResult.error ??
        opportunitiesResult.error;

      if (firstError) {
        throw firstError;
      }

      return {
        lists: listsResult.count ?? 0,
        leads: leadsResult.count ?? 0,
        contacted: contactedResult.count ?? 0,
        engaged: engagedResult.count ?? 0,
        opportunities:
          opportunitiesResult.count ?? 0,
      };
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
