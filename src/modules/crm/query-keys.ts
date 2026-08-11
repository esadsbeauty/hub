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
};
