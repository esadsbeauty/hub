export const crmKeys = {
  all: ["crm"] as const,
  companies: () => [...crmKeys.all, "companies"] as const,
  company: (companyId: string) => [...crmKeys.companies(), companyId] as const,
  pipeline: () => [...crmKeys.all, "pipeline"] as const,
  opportunities: () => [...crmKeys.all, "opportunities"] as const,
  opportunity: (opportunityId: string) =>
    [...crmKeys.opportunities(), opportunityId] as const,
  activities: (companyId: string) =>
    [...crmKeys.company(companyId), "activities"] as const,
  tasks: (companyId: string) =>
    [...crmKeys.company(companyId), "tasks"] as const,
  tasksRange: (from: string, to: string, assigneeId?: string) =>
    [...crmKeys.all, "tasks", "range", from, to, assigneeId ?? "all"] as const,
  tasksOverdue: (until: string) =>
    [...crmKeys.all, "tasks", "overdue", until] as const,
  activitiesCompany: (companyId: string, pageSize: number) =>
    [...crmKeys.all, "activities", "company", companyId, pageSize] as const,
  activitiesOpportunity: (opportunityId: string, pageSize: number) =>
    [
      ...crmKeys.all,
      "activities",
      "opportunity",
      opportunityId,
      pageSize,
    ] as const,
};
