import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { crmRepository } from './repository';
import type { ActivityFormData, CompanyFormData, ContactFormData, FollowUpFormData } from './schema';
import type { CompanyFile, LeadStatus } from './types';

type UpdateCompanyInput = { id: string; data: Partial<CompanyFormData> };
type MoveCompanyInput = { id: string; status: LeadStatus };
type CreateContactInput = { companyId: string; data: ContactFormData };
type UpdateContactInput = { id: string; data: Partial<ContactFormData> };
type CreateFollowUpInput = { companyId: string; data: FollowUpFormData };
type UpdateFollowUpInput = { id: string; data: Partial<FollowUpFormData> };
type CreateActivityInput = { companyId: string; data: ActivityFormData };
type AddNoteInput = { companyId: string; text: string };
type AddFileInput = { companyId: string; file: Omit<CompanyFile, 'id' | 'companyId' | 'user' | 'createdAt'> };

export function useCrmData() {
  return useQuery({ queryKey: ['crm'], queryFn: crmRepository.list });
}

export function useCrmActions() {
  const queryClient = useQueryClient();
  const invalidateCrm = () => queryClient.invalidateQueries({ queryKey: ['crm'] });

  return {
    createCompany: useMutation({ mutationFn: (data: CompanyFormData) => crmRepository.createCompany(data), onSuccess: invalidateCrm }),
    updateCompany: useMutation({ mutationFn: ({ id, data }: UpdateCompanyInput) => crmRepository.updateCompany(id, data), onSuccess: invalidateCrm }),
    moveCompany: useMutation({ mutationFn: ({ id, status }: MoveCompanyInput) => crmRepository.moveCompany(id, status), onSuccess: invalidateCrm }),
    deleteCompany: useMutation({ mutationFn: (id: string) => crmRepository.deleteCompany(id), onSuccess: invalidateCrm }),
    duplicateCompany: useMutation({ mutationFn: (id: string) => crmRepository.duplicateCompany(id), onSuccess: invalidateCrm }),
    createContact: useMutation({ mutationFn: ({ companyId, data }: CreateContactInput) => crmRepository.createContact(companyId, data), onSuccess: invalidateCrm }),
    updateContact: useMutation({ mutationFn: ({ id, data }: UpdateContactInput) => crmRepository.updateContact(id, data), onSuccess: invalidateCrm }),
    deleteContact: useMutation({ mutationFn: (id: string) => crmRepository.deleteContact(id), onSuccess: invalidateCrm }),
    createFollowUp: useMutation({ mutationFn: ({ companyId, data }: CreateFollowUpInput) => crmRepository.createFollowUp(companyId, data), onSuccess: invalidateCrm }),
    updateFollowUp: useMutation({ mutationFn: ({ id, data }: UpdateFollowUpInput) => crmRepository.updateFollowUp(id, data), onSuccess: invalidateCrm }),
    createActivity: useMutation({ mutationFn: ({ companyId, data }: CreateActivityInput) => crmRepository.createActivity(companyId, data), onSuccess: invalidateCrm }),
    addNote: useMutation({ mutationFn: ({ companyId, text }: AddNoteInput) => crmRepository.addNote(companyId, text), onSuccess: invalidateCrm }),
    addFile: useMutation({ mutationFn: ({ companyId, file }: AddFileInput) => crmRepository.addFile(companyId, file), onSuccess: invalidateCrm }),
  };
}
