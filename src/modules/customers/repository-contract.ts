import type { Contract, ContractInput, CustomerData, CustomerService, CustomerServiceInput, Onboarding, OnboardingInput, OnboardingStep, OnboardingStepInput, Service, ServiceInput } from "./types";

export interface CustomerRepository {
  list(): Promise<CustomerData>;
  createService(input: ServiceInput): Promise<Service>;
  addCustomerService(input: CustomerServiceInput): Promise<CustomerService>;
  startOnboarding(input: OnboardingInput): Promise<Onboarding>;
  addOnboardingStep(input: OnboardingStepInput): Promise<OnboardingStep>;
  completeOnboardingStep(id: string): Promise<OnboardingStep>;
  createContract(input: ContractInput): Promise<Contract>;
  activateContract(id: string): Promise<Contract>;
  setCustomerStatus(id: string, status: "active" | "paused" | "cancelled", reason?: string): Promise<void>;
}
