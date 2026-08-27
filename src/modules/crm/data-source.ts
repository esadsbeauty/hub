import { isLocalMode } from "@/config/app-mode";
import { crmRepository } from "./repository";
import { supabaseCrmRepository } from "./supabase-repository";
import type { FollowUpFormData, TaskFormData } from "./schema";
import type { CompanyFile, Task } from "./types";

const source = isLocalMode ? crmRepository : supabaseCrmRepository;

export const crmDataSource = {
  list: () => source.list(),
  listTasksRange: (from: string, to: string) => source.listTasksRange(from, to),
  listOverdueTasks: (until: string) => source.listOverdueTasks(until),
  createCompany: (input: Parameters<typeof source.createCompany>[0]) =>
    source.createCompany(input),
  updateCompany: (
    id: string,
    input: Parameters<typeof source.updateCompany>[1],
  ) => source.updateCompany(id, input),
  deleteCompany: (id: string) => source.deleteCompany(id),
  duplicateCompany: (id: string) => source.duplicateCompany(id),
  createOpportunity: (input: Parameters<typeof source.createOpportunity>[0]) =>
    source.createOpportunity(input),
  updateOpportunity: (
    id: string,
    input: Parameters<typeof source.updateOpportunity>[1],
  ) => source.updateOpportunity(id, input),
  moveOpportunity: (id: string, stageId: string) =>
    source.moveOpportunity(id, stageId),
  markOpportunityWon: (id: string, input: import("./schema").WonOpportunityFormData) => source.markOpportunityWon(id,input),
  markOpportunityLost: (
    id: string,
    input: Parameters<typeof source.markOpportunityLost>[1],
  ) => source.markOpportunityLost(id, input),
  archiveOpportunity: (id: string) => source.archiveOpportunity(id),
  duplicateOpportunity: (id: string) => source.duplicateOpportunity(id),
  createContact: (
    companyId: string,
    input: Parameters<typeof source.createContact>[1],
  ) => source.createContact(companyId, input),
  updateContact: (
    id: string,
    input: Parameters<typeof source.updateContact>[1],
  ) => source.updateContact(id, input),
  deleteContact: (id: string) => source.deleteContact(id),
  createTask: (input: TaskFormData): Promise<Task> => source.createTask(input),
  createFollowUp: (
    companyId: string,
    input: FollowUpFormData,
    opportunityId?: string,
  ): Promise<Task> => source.createFollowUp(companyId, input, opportunityId),
  updateFollowUp: (
    id: string,
    input: Partial<FollowUpFormData>,
  ): Promise<void> => source.updateFollowUp(id, input),
  completeTask: (id: string): Promise<Task> => source.completeTask(id),
  rescheduleTask: (id: string, dueAt: string): Promise<Task> =>
    source.rescheduleTask(id, dueAt),
  cancelTask: (id: string): Promise<Task> => source.cancelTask(id),
  addNote: (companyId: string, text: string, opportunityId?: string) =>
    source.addNote(companyId, text, opportunityId),
  createActivity: (
    companyId: string,
    input: Parameters<typeof source.createActivity>[1],
  ) => source.createActivity(companyId, input),
  addFile: async (
    _companyId: string,
    _file: Omit<CompanyFile, "id" | "organizationId" | "companyId" | "user" | "createdAt">,
  ) => {
    throw new Error("Arquivos ainda não estão disponíveis neste ambiente.");
  },
};
