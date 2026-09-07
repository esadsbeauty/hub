export const customerKeys = {
  root: ["customers"] as const,
  all: (organizationId: string) => [...customerKeys.root, organizationId] as const,
  lists: (organizationId: string) => [...customerKeys.all(organizationId), "list"] as const,
  detail: (organizationId: string, id: string) => [...customerKeys.all(organizationId), "detail", id] as const,
  company: (organizationId: string, companyId: string) => [...customerKeys.all(organizationId), "company", companyId] as const,
  services: (organizationId: string) => [...customerKeys.all(organizationId), "services"] as const,
  onboarding: (organizationId: string, id: string) => [...customerKeys.all(organizationId), "onboarding", id] as const,
  contracts: (organizationId: string, id: string) => [...customerKeys.all(organizationId), "contracts", id] as const,
};
