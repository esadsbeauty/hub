import type { AnalyticsFilters } from "./types";

export const analyticsKeys = {
  all: ["analytics"] as const,
  dashboard: (organizationId: string, filters: AnalyticsFilters) =>
    [...analyticsKeys.all, "dashboard", organizationId, filters] as const,
  reports: (organizationId: string, filters: AnalyticsFilters) =>
    [...analyticsKeys.all, "reports", organizationId, filters] as const,
};
