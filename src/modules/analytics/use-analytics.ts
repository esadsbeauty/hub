import { useQuery } from "@tanstack/react-query";
import { useCrmData } from "@/modules/crm/hooks";
import { calculateAnalytics } from "./analytics-service";
import { analyticsKeys } from "./query-keys";
import type { AnalyticsFilters } from "./types";

export function useAnalytics(
  filters: AnalyticsFilters,
  scope: "dashboard" | "reports" = "dashboard",
) {
  const crm = useCrmData();
  const organizationId = crm.data?.organization.id ?? "pending";
  const baseKey =
    scope === "dashboard"
      ? analyticsKeys.dashboard(organizationId, filters)
      : analyticsKeys.reports(organizationId, filters);
  const query = useQuery({
    queryKey: [...baseKey, crm.dataUpdatedAt],
    enabled: Boolean(crm.data),
    queryFn: () => {
      if (!crm.data) throw new Error("Dados comerciais indisponíveis.");
      return calculateAnalytics(crm.data, filters);
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
  return { ...query, analytics: query.data, crm };
}
