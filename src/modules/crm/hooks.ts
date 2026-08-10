import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crmRepository } from './repository';
import type { ActivityFormData, CompanyFormData, ContactFormData, FollowUpFormData } from './schema';
import type { CompanyFile } from './types';

type WithCompany<T> = { companyId: string; data: T };
export function useCrmData() { return useQuery({ queryKey: ['crm'], queryFn: crmRepository.list }); }
export function useCrmActions() {
  const client = useQueryClient(); const refresh = () => client.invalidateQueries({ queryKey: ['crm'] });
  return {
    createCompany: useMutation({ mutationFn: crmRepository.createCompany, onSuccess: refresh }), updateCompany: useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<CompanyFormData> }) => crmRepository.updateCompany(id, data), onSuccess: refresh }), deleteCompany: useMutation({ mutationFn: crmRepository.deleteCompany, onSuccess: refresh }), duplicateCompany: useMutation({ mutationFn: crmRepository.duplicateCompany, onSuccess: refresh }),
    moveOpportunity: useMutation({ mutationFn: ({ opportunityId, stageId }: { opportunityId: string; stageId: string }) => crmRepository.moveOpportunity(opportunityId, stageId), onSuccess: refresh }),
    createContact: useMutation({ mutationFn: ({ companyId, data }: WithCompany<ContactFormData>) => crmRepository.createContact(companyId, data), onSuccess: refresh }), updateContact: useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<ContactFormData> }) => crmRepository.updateContact(id, data), onSuccess: refresh }), deleteContact: useMutation({ mutationFn: crmRepository.deleteContact, onSuccess: refresh }),
    createFollowUp: useMutation({ mutationFn: ({ companyId, data }: WithCompany<FollowUpFormData>) => crmRepository.createFollowUp(companyId, data), onSuccess: refresh }), updateFollowUp: useMutation({ mutationFn: ({ id, data }: { id: string; data: Partial<FollowUpFormData> }) => crmRepository.updateFollowUp(id, data), onSuccess: refresh }), createActivity: useMutation({ mutationFn: ({ companyId, data }: WithCompany<ActivityFormData>) => crmRepository.createActivity(companyId, data), onSuccess: refresh }), addNote: useMutation({ mutationFn: ({ companyId, text }: { companyId: string; text: string }) => crmRepository.addNote(companyId, text), onSuccess: refresh }), addFile: useMutation({ mutationFn: ({ companyId, file }: { companyId: string; file: Omit<CompanyFile, 'id' | 'organizationId' | 'companyId' | 'user' | 'createdAt'> }) => crmRepository.addFile(companyId, file), onSuccess: refresh }),
  };
}
