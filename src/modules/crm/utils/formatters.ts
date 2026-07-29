import { PIPELINE, type LeadStatus } from '../types';

export const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function pipelineLabel(status: LeadStatus) { return PIPELINE.find((stage) => stage.id === status)?.label ?? status; }
export function formatDateTime(value?: string) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }
export function todayISO() { return new Date().toISOString().slice(0, 10); }
export function parseLeadStatus(value: string): LeadStatus | null {
  switch (value) {
    case 'novo_lead':
    case 'pesquisado':
    case 'primeiro_contato':
    case 'aguardando_resposta':
    case 'em_conversa':
    case 'reuniao_agendada':
    case 'proposta_enviada':
    case 'negociacao':
    case 'cliente_fechado':
    case 'perdido':
      return value;
    default:
      return null;
  }
}
