export const leadStatusOptions = ['novo_lead', 'pesquisado', 'primeiro_contato', 'aguardando_resposta', 'em_conversa', 'reuniao_agendada', 'proposta_enviada', 'negociacao', 'cliente_fechado', 'perdido'] as const;
export type LeadStatus = typeof leadStatusOptions[number];

export const PIPELINE: { id: LeadStatus; label: string }[] = [
  { id: 'novo_lead', label: 'Novo Lead' },
  { id: 'pesquisado', label: 'Pesquisado' },
  { id: 'primeiro_contato', label: 'Primeiro Contato' },
  { id: 'aguardando_resposta', label: 'Aguardando Resposta' },
  { id: 'em_conversa', label: 'Em Conversa' },
  { id: 'reuniao_agendada', label: 'Reunião Agendada' },
  { id: 'proposta_enviada', label: 'Proposta Enviada' },
  { id: 'negociacao', label: 'Negociação' },
  { id: 'cliente_fechado', label: 'Cliente Fechado' },
  { id: 'perdido', label: 'Perdido' },
];

export type Priority = 'baixa' | 'media' | 'alta';
export type Temperature = 'frio' | 'morno' | 'quente';
export type ContactStatus = 'ativo' | 'inativo';
export type FollowUpStatus = 'pendente' | 'concluido' | 'reagendado' | 'cancelado';
export type ActivityStatus = 'agendado' | 'realizado' | 'cancelado';
export type ActivityType = 'ligacao' | 'whatsapp' | 'reuniao' | 'visita' | 'videochamada' | 'apresentacao' | 'retorno';

export type Company = {
  id: string; fantasyName: string; legalName?: string; cnpj?: string; phone?: string; whatsapp?: string; instagram?: string; facebook?: string; website?: string; email?: string;
  zipCode?: string; address?: string; number?: string; complement?: string; district?: string; city?: string; state?: string;
  responsibleName?: string; responsibleRole?: string; employees?: number; businessArea?: string; leadSource?: string; owner?: string;
  temperature: Temperature; priority: Priority; status: LeadStatus; estimatedValue: number; notes?: string; tags: string[];
  createdAt: string; updatedAt: string; lastInteractionAt?: string; nextFollowUpAt?: string; nextMeetingAt?: string; deletedAt?: string | null;
};
export type CompanyContact = { id: string; companyId: string; name: string; role?: string; phone?: string; whatsapp?: string; email?: string; instagram?: string; linkedin?: string; birthDate?: string; notes?: string; isPrimary: boolean; isFinancial: boolean; isCommercial: boolean; status: ContactStatus; createdAt: string; updatedAt: string };
export type TimelineEvent = { id: string; companyId: string; user: string; type: string; description: string; createdAt: string };
export type FollowUp = { id: string; companyId: string; title: string; description?: string; date: string; time: string; owner: string; priority: Priority; type: 'ligacao' | 'whatsapp' | 'email' | 'reuniao' | 'proposta' | 'outro'; status: FollowUpStatus; notes?: string; createdAt: string; updatedAt: string };
export type CommercialActivity = { id: string; companyId: string; contactId?: string; title: string; description?: string; type: ActivityType; owner: string; date: string; time: string; durationMinutes: number; location?: string; status: ActivityStatus; notes?: string; createdAt: string; updatedAt: string };
export type CompanyFile = { id: string; companyId: string; name: string; category: 'contrato' | 'pdf' | 'imagem' | 'planilha' | 'apresentacao' | 'outro'; type: string; size: string; user: string; createdAt: string };
export type CompanyNote = { id: string; companyId: string; text: string; author: string; createdAt: string; updatedAt: string };
export type CrmData = { companies: Company[]; contacts: CompanyContact[]; events: TimelineEvent[]; followUps: FollowUp[]; activities: CommercialActivity[]; files: CompanyFile[]; notes: CompanyNote[] };
