export const crmKeys = {
  root: ["crm"] as const,
  all: (organizationId: string) => [...crmKeys.root, organizationId] as const,
  companies: (organizationId: string) => [...crmKeys.all(organizationId), "companies"] as const,
  company: (organizationId: string, companyId: string) => [...crmKeys.companies(organizationId), companyId] as const,
  opportunities: (organizationId: string) => [...crmKeys.all(organizationId), "opportunities"] as const,
  opportunity: (organizationId: string, opportunityId: string) => [...crmKeys.opportunities(organizationId), opportunityId] as const,
  taskOperations: (organizationId: string) => [...crmKeys.all(organizationId), "tasks"] as const,
  taskRanges: (organizationId: string) => [...crmKeys.taskOperations(organizationId), "range"] as const,
  tasksRange: (organizationId: string, from: string, to: string, assigneeId?: string) => [...crmKeys.taskRanges(organizationId), from, to, assigneeId ?? "all"] as const,
  tasksOverdue: (organizationId: string, until: string) => [...crmKeys.taskOperations(organizationId), "overdue", until] as const,
  activitiesCompany: (organizationId: string, companyId: string, pageSize: number) => [...crmKeys.all(organizationId), "activities", "company", companyId, pageSize] as const,
  activitiesOpportunity: (organizationId: string, opportunityId: string, pageSize: number) => [...crmKeys.all(organizationId), "activities", "opportunity", opportunityId, pageSize] as const,
};
