import { PIPELINE } from '../types';
import type { LeadStatus } from '@/shared/types/database';
export const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
export function pipelineLabel(status: LeadStatus) { return PIPELINE.find((stage) => stage.id === status)?.label ?? status; }
export function formatDateTime(value?: string) { return value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '—'; }
export function todayISO() { return new Date().toISOString().slice(0, 10); }
