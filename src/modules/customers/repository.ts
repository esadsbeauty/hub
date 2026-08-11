import { crmRepository } from "@/modules/crm/repository";
import type { CustomerRepository } from "./repository-contract";
import type { Contract, CustomerAccount, CustomerData, OnboardingStep } from "./types";

const STORAGE = "esads_customer_data_v1";
const ORG = "esads-beauty";
const USER = "preview-admin";
const now = () => new Date().toISOString();
const id = () => crypto.randomUUID();
const empty = (): CustomerData => ({ accounts: [], services: [], customerServices: [], onboardings: [], steps: [], contracts: [] });
const read = () => { const raw = localStorage.getItem(STORAGE); return raw ? JSON.parse(raw) as CustomerData : empty(); };
const write = (data: CustomerData) => localStorage.setItem(STORAGE, JSON.stringify(data));

async function reconciled(): Promise<CustomerData> {
  const data = read();
  const crm = await crmRepository.list();
  for (const opportunity of crm.opportunities.filter((item) => item.status === "won" && !item.deletedAt)) {
    const existing = data.accounts.find((item) => item.companyId === opportunity.companyId);
    if (existing) {
      if (existing.status === "cancelled" || existing.status === "inactive") { existing.status = "onboarding"; existing.cancelledAt = undefined; existing.updatedAt = now(); }
      continue;
    }
    data.accounts.push({ id: id(), organizationId: ORG, companyId: opportunity.companyId, status: "onboarding", clientSince: opportunity.wonAt ?? opportunity.updatedAt, ownerId: opportunity.ownerId, successOwnerId: opportunity.ownerId, sourceOpportunityId: opportunity.id, createdAt: now(), updatedAt: now() });
  }
  write(data);
  return data;
}

export const customerRepository: CustomerRepository = {
  list: reconciled,
  async createService(input) { const data = await reconciled(); const item = { id: id(), organizationId: ORG, ...input, isActive: true, createdAt: now(), updatedAt: now() }; data.services.push(item); write(data); return item; },
  async addCustomerService(input) { const data = await reconciled(); const item = { id: id(), organizationId: ORG, ...input, status: "pending" as const, createdAt: now(), updatedAt: now() }; data.customerServices.push(item); write(data); return item; },
  async startOnboarding(input) { const data = await reconciled(); const item = { id: id(), organizationId: ORG, ...input, status: "in_progress" as const, startedAt: now(), createdAt: now(), updatedAt: now() }; data.onboardings.push(item); const account = data.accounts.find((entry) => entry.id === input.customerAccountId); if (account) account.status = "onboarding"; write(data); return item; },
  async addOnboardingStep(input) { const data = await reconciled(); const position = data.steps.filter((step) => step.onboardingId === input.onboardingId).length + 1; const taskId = input.createTask ? id() : undefined; if (taskId && input.dueAt) { const crm = await crmRepository.list(); crm.tasks.push({ id: taskId, organizationId: ORG, assignedTo: input.assignedTo ?? USER, createdBy: USER, title: input.title, description: input.description, type: "task", status: "pending", priority: "medium", dueAt: input.dueAt, createdAt: now(), updatedAt: now() }); localStorage.setItem("esads_crm_data_v3", JSON.stringify(crm)); }
    const item: OnboardingStep = { id: id(), organizationId: ORG, onboardingId: input.onboardingId, title: input.title, description: input.description, assignedTo: input.assignedTo, dueAt: input.dueAt, blockedBy: input.blockedBy, taskId, position, status: "pending", createdAt: now(), updatedAt: now() }; data.steps.push(item); write(data); return item; },
  async completeOnboardingStep(stepId) { const data = await reconciled(); const item = data.steps.find((step) => step.id === stepId); if (!item) throw new Error("Etapa não encontrada."); item.status = "completed"; item.completedAt = now(); item.updatedAt = now(); if (item.taskId) await crmRepository.completeTask(item.taskId); const onboardingSteps = data.steps.filter((step) => step.onboardingId === item.onboardingId && step.status !== "cancelled"); const onboarding = data.onboardings.find((entry) => entry.id === item.onboardingId); if (onboarding && onboardingSteps.every((step) => step.status === "completed")) { onboarding.status = "completed"; onboarding.completedAt = now(); } write(data); return item; },
  async createContract(input) { const data = await reconciled(); const sequence = String(data.contracts.length + 1).padStart(4, "0"); const item: Contract = { id: id(), organizationId: ORG, ...input, contractNumber: `CTR-${new Date().getFullYear()}-${sequence}`, status: "draft", createdAt: now(), updatedAt: now() }; data.contracts.push(item); write(data); return item; },
  async activateContract(contractId) { const data = await reconciled(); const item = data.contracts.find((contract) => contract.id === contractId); if (!item) throw new Error("Contrato não encontrado."); item.status = "active"; item.signedAt = now(); item.updatedAt = now(); write(data); return item; },
  async setCustomerStatus(accountId, status, reason) { const data = await reconciled(); const item = data.accounts.find((account) => account.id === accountId); if (!item) throw new Error("Cliente não encontrado."); item.status = status; item.cancellationReason = status === "cancelled" ? reason : undefined; item.cancelledAt = status === "cancelled" ? now() : undefined; item.updatedAt = now(); write(data); },
};
