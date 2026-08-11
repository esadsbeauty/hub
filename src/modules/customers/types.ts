export type CustomerStatus = "onboarding" | "active" | "paused" | "cancelled" | "inactive";
export type ServiceStatus = "pending" | "active" | "paused" | "completed" | "cancelled";
export type OnboardingStatus = "not_started" | "in_progress" | "blocked" | "completed" | "cancelled";
export type OnboardingStepStatus = "pending" | "in_progress" | "completed" | "blocked" | "cancelled";
export type ContractStatus = "draft" | "sent" | "signed" | "active" | "expired" | "cancelled";
export type BillingType = "one_time" | "recurring" | "custom";
export type BillingInterval = "monthly" | "quarterly" | "yearly" | "one_time" | "custom";

export type CustomerAccount = { id: string; organizationId: string; companyId: string; status: CustomerStatus; clientSince: string; ownerId?: string; successOwnerId?: string; sourceOpportunityId?: string; cancellationReason?: string; cancellationNotes?: string; cancelledAt?: string; createdAt: string; updatedAt: string };
export type Service = { id: string; organizationId: string; name: string; description?: string; category?: string; defaultPrice?: number; billingType: BillingType; isActive: boolean; createdAt: string; updatedAt: string };
export type CustomerService = { id: string; organizationId: string; customerAccountId: string; serviceId: string; sourceOpportunityId?: string; status: ServiceStatus; startDate?: string; endDate?: string; agreedPrice?: number; billingType: BillingType; billingInterval: BillingInterval; ownerId?: string; notes?: string; createdAt: string; updatedAt: string; cancelledAt?: string };
export type Onboarding = { id: string; organizationId: string; customerAccountId: string; customerServiceId?: string; sourceOpportunityId?: string; title: string; status: OnboardingStatus; ownerId?: string; startedAt?: string; dueAt?: string; completedAt?: string; createdAt: string; updatedAt: string };
export type OnboardingStep = { id: string; organizationId: string; onboardingId: string; taskId?: string; title: string; description?: string; position: number; status: OnboardingStepStatus; assignedTo?: string; dueAt?: string; completedAt?: string; blockedBy?: "internal" | "client" | "external"; blockedReason?: string; createdAt: string; updatedAt: string };
export type Contract = { id: string; organizationId: string; customerAccountId: string; sourceOpportunityId?: string; title: string; status: ContractStatus; contractNumber: string; startDate: string; endDate?: string; signedAt?: string; value?: number; billingType: BillingType; billingInterval: BillingInterval; autoRenew: boolean; noticeDays: number; ownerId?: string; notes?: string; customerServiceIds: string[]; createdAt: string; updatedAt: string; cancelledAt?: string };
export type CustomerData = { accounts: CustomerAccount[]; services: Service[]; customerServices: CustomerService[]; onboardings: Onboarding[]; steps: OnboardingStep[]; contracts: Contract[] };

export type ServiceInput = Pick<Service, "name" | "billingType"> & Partial<Pick<Service, "description" | "category" | "defaultPrice">>;
export type CustomerServiceInput = Omit<CustomerService, "id" | "organizationId" | "createdAt" | "updatedAt" | "cancelledAt" | "status">;
export type OnboardingInput = Pick<Onboarding, "customerAccountId" | "title"> & Partial<Pick<Onboarding, "customerServiceId" | "sourceOpportunityId" | "ownerId" | "dueAt">>;
export type OnboardingStepInput = Pick<OnboardingStep, "onboardingId" | "title"> & Partial<Pick<OnboardingStep, "description" | "assignedTo" | "dueAt" | "blockedBy">> & { createTask?: boolean };
export type ContractInput = Omit<Contract, "id" | "organizationId" | "contractNumber" | "createdAt" | "updatedAt" | "cancelledAt" | "signedAt" | "status">;
