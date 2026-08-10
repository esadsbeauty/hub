export type Priority = 'baixa' | 'media' | 'alta';
export type Temperature = 'frio' | 'morno' | 'quente';
export type ContactStatus = 'ativo' | 'inativo';
export type OpportunityStatus = 'open' | 'won' | 'lost' | 'archived';
export type TaskStatus = 'pending' | 'completed' | 'cancelled';
export type TaskType = 'follow_up' | 'call' | 'whatsapp' | 'email' | 'meeting' | 'task';
export type ActivityType = 'company_created' | 'company_updated' | 'contact_created' | 'opportunity_created' | 'stage_changed' | 'followup_created' | 'followup_completed' | 'meeting_scheduled' | 'task_created' | 'task_completed' | 'note_created' | 'deal_won' | 'deal_lost';

export type Organization = { id: string; name: string; slug: string; createdAt: string; updatedAt: string };
export type Profile = { id: string; organizationId: string; name: string; email: string; role: 'admin' | 'manager' | 'sales' | 'financial' | 'member'; avatarUrl?: string; createdAt: string; updatedAt: string };
export type Pipeline = { id: string; organizationId: string; name: string; description?: string; isDefault: boolean; createdAt: string; updatedAt: string };
export type PipelineStage = { id: string; pipelineId: string; name: string; slug: string; position: number; probability: number; isWon: boolean; isLost: boolean; createdAt: string; updatedAt: string };

export type Company = {
  id: string; organizationId: string; fantasyName: string; legalName?: string; cnpj?: string; phone?: string; whatsapp?: string; instagram?: string; facebook?: string; website?: string; email?: string;
  zipCode?: string; address?: string; number?: string; complement?: string; district?: string; city?: string; state?: string; responsibleName?: string; responsibleRole?: string;
  employees?: number; businessArea?: string; leadSource?: string; ownerId?: string; owner?: string; temperature: Temperature; priority: Priority; notes?: string; tags: string[];
  lifecycleStage: 'lead' | 'customer' | 'inactive'; createdBy: string; createdAt: string; updatedAt: string; lastInteractionAt?: string; deletedAt?: string | null;
};
export type Opportunity = { id: string; organizationId: string; companyId: string; pipelineId: string; stageId: string; title: string; description?: string; value: number; probability: number; expectedCloseDate?: string; ownerId?: string; owner?: string; source?: string; status: OpportunityStatus; lostReason?: string; wonAt?: string; lostAt?: string; createdBy: string; createdAt: string; updatedAt: string; stageEnteredAt: string; deletedAt?: string | null };
export type CompanyContact = { id: string; organizationId: string; companyId: string; name: string; role?: string; phone?: string; whatsapp?: string; email?: string; instagram?: string; linkedin?: string; birthDate?: string; notes?: string; isPrimary: boolean; isFinancial: boolean; isCommercial: boolean; status: ContactStatus; createdAt: string; updatedAt: string; deletedAt?: string | null };
export type TimelineEvent = { id: string; organizationId: string; companyId?: string; opportunityId?: string; userId: string; user: string; type: ActivityType; title: string; description?: string; metadata: Record<string, string | number | boolean | null>; createdAt: string };
export type Task = { id: string; organizationId: string; companyId?: string; opportunityId?: string; assignedTo: string; createdBy: string; title: string; description?: string; type: TaskType; status: TaskStatus; priority: Priority; dueDate: string; completedAt?: string; createdAt: string; updatedAt: string; deletedAt?: string | null };
export type FollowUp = Task;
export type CommercialActivity = { id: string; organizationId: string; companyId: string; opportunityId?: string; contactId?: string; title: string; description?: string; type: 'ligacao' | 'whatsapp' | 'reuniao' | 'visita' | 'videochamada' | 'apresentacao' | 'retorno'; owner: string; date: string; time: string; durationMinutes: number; location?: string; status: 'agendado' | 'realizado' | 'cancelado'; notes?: string; createdAt: string; updatedAt: string };
export type CompanyFile = { id: string; organizationId: string; companyId: string; name: string; category: 'contrato' | 'pdf' | 'imagem' | 'planilha' | 'apresentacao' | 'outro'; type: string; size: string; user: string; createdAt: string };
export type CompanyNote = { id: string; organizationId: string; companyId: string; text: string; author: string; createdAt: string; updatedAt: string };
export type CrmData = { organization: Organization; profile: Profile; companies: Company[]; contacts: CompanyContact[]; pipelines: Pipeline[]; stages: PipelineStage[]; opportunities: Opportunity[]; events: TimelineEvent[]; tasks: Task[]; activities: CommercialActivity[]; files: CompanyFile[]; notes: CompanyNote[] };
