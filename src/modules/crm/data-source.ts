import { supabase } from "@/lib/supabase";
import { crmRepository } from "./repository";
import { supabaseCrmRepository } from "./supabase-repository";

const source = supabase ? supabaseCrmRepository : crmRepository;

export const crmDataSource = {
  list: () => source.list(),
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
  markOpportunityWon: (id: string) => source.markOpportunityWon(id),
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
  createFollowUp: (
    companyId: string,
    input: Parameters<typeof source.createFollowUp>[1],
    opportunityId?: string,
  ) => source.createFollowUp(companyId, input, opportunityId),
  updateFollowUp: (
    id: string,
    input: Parameters<typeof source.updateFollowUp>[1],
  ) => source.updateFollowUp(id, input),
  completeTask: (id: string) => source.completeTask(id),
  addNote: (companyId: string, text: string, opportunityId?: string) =>
    source.addNote(companyId, text, opportunityId),
  createActivity: (
    companyId: string,
    input: Parameters<typeof source.createActivity>[1],
  ) => source.createActivity(companyId, input),
  addFile: supabase
    ? async () => {
        throw new Error("Arquivos ainda não estão disponíveis neste ambiente.");
      }
    : (companyId: string, file: Parameters<typeof crmRepository.addFile>[1]) =>
        crmRepository.addFile(companyId, file),
};
