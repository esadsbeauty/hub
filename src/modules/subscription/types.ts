export type SubscriptionAccessStatus = "active" | "pending" | "past_due" | "suspended" | "cancelled";
export type SubscriptionAccess = { status: SubscriptionAccessStatus; persistedStatus: SubscriptionAccessStatus; isBlocked: boolean; isPlatformAdmin: boolean; planName?: string; priceCents?: number; nextDueAt?: string; gracePeriodEndsAt?: string; daysOverdue: number };
