export type PlatformPlan = { id: string; name: string; slug: string; priceCents: number; billingMode: "manual" | "automatic"; isActive: boolean; entitlements: string[] };
export type PlatformOrganization = { id: string; name: string; planId?: string; planName?: string; status?: string; startsAt?: string; createdAt?: string; ownerName?: string; ownerEmail?: string };
export type PlatformSnapshot = { plans: PlatformPlan[]; organizations: PlatformOrganization[] };
export type ProvisionOrganizationInput = { organizationName: string; ownerName: string; ownerEmail: string; ownerWhatsapp: string; planId?: string; pipelineName: string };
