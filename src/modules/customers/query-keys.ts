export const customerKeys = {
  all: ["customers"] as const,
  lists: () => [...customerKeys.all, "list"] as const,
  detail: (id: string) => [...customerKeys.all, "detail", id] as const,
  company: (companyId: string) => [...customerKeys.all, "company", companyId] as const,
  services: () => [...customerKeys.all, "services"] as const,
  onboarding: (id: string) => [...customerKeys.all, "onboarding", id] as const,
  contracts: (id: string) => [...customerKeys.all, "contracts", id] as const,
};
