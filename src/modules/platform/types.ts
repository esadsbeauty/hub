export type PlatformPlan = { id: string; name: string; slug: string; priceCents: number; billingMode: "manual" | "automatic"; isActive: boolean; entitlements: string[] };
export type PlatformOrganization = { id: string; name: string; planId?: string; planName?: string; status?: string; startsAt?: string };
export type PlatformSnapshot = { plans: PlatformPlan[]; organizations: PlatformOrganization[] };
