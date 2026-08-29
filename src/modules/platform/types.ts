export type SubscriptionStatus = "active" | "pending" | "past_due" | "suspended" | "cancelled";
export type PlatformSubscription = { id: string; status: SubscriptionStatus; storedStatus: SubscriptionStatus; priceCents: number; currency: string; startedAt: string; nextDueAt: string; lastPaymentAt?: string; gracePeriodEndsAt: string; paymentMethod: string; daysOverdue: number };
export type PlatformPlan = { id: string; name: string; slug: string; priceCents: number; billingMode: "manual" | "automatic"; isActive: boolean; entitlements: string[] };
export type PlatformOrganization = { id: string; name: string; planId?: string; planName?: string; status?: string; startsAt?: string; createdAt?: string; ownerName?: string; ownerEmail?: string; subscription?: PlatformSubscription };
export type PlatformMetrics = { activeCustomers: number; mrrCents: number; pastDue: number; suspended: number };
export type PlatformSnapshot = { plans: PlatformPlan[]; organizations: PlatformOrganization[]; metrics: PlatformMetrics };
export type ProvisionOrganizationInput = { organizationName: string; ownerName: string; ownerEmail: string; ownerWhatsapp: string; planId?: string; pipelineName: string };
