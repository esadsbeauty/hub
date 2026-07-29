import { z } from 'zod';
import { PIPELINE } from './types';
import type { LeadStatus } from '@/shared/types/database';

export const companySchema = z.object({
  fantasyName: z.string().min(2, 'Informe o nome fantasia'), legalName: z.string().optional(), cnpj: z.string().optional(), phone: z.string().optional(), whatsapp: z.string().optional(), instagram: z.string().optional(), facebook: z.string().optional(), website: z.string().optional(), email: z.string().email('Email inválido').optional().or(z.literal('')),
  zipCode: z.string().optional(), address: z.string().optional(), number: z.string().optional(), complement: z.string().optional(), district: z.string().optional(), city: z.string().optional(), state: z.string().max(2).optional(),
  responsibleName: z.string().optional(), responsibleRole: z.string().optional(), employees: z.coerce.number().min(0).optional(), businessArea: z.string().optional(), leadSource: z.string().optional(), owner: z.string().optional(),
  temperature: z.enum(['frio', 'morno', 'quente']), priority: z.enum(['baixa', 'media', 'alta']), status: z.enum(PIPELINE.map((stage) => stage.id) as [LeadStatus, ...LeadStatus[]]), estimatedValue: z.coerce.number().min(0), notes: z.string().optional(), tags: z.string().optional(),
});
export type CompanyFormData = z.infer<typeof companySchema>;
export const contactSchema = z.object({ name: z.string().min(2), role: z.string().optional(), phone: z.string().optional(), whatsapp: z.string().optional(), email: z.string().email().optional().or(z.literal('')), instagram: z.string().optional(), linkedin: z.string().optional(), birthDate: z.string().optional(), notes: z.string().optional(), isPrimary: z.boolean().default(false), isFinancial: z.boolean().default(false), isCommercial: z.boolean().default(false), status: z.enum(['ativo', 'inativo']).default('ativo') });
export type ContactFormData = z.infer<typeof contactSchema>;
export const followUpSchema = z.object({ title: z.string().min(2), description: z.string().optional(), date: z.string().min(1), time: z.string().min(1), owner: z.string().min(2), priority: z.enum(['baixa', 'media', 'alta']), type: z.enum(['ligacao', 'whatsapp', 'email', 'reuniao', 'proposta', 'outro']), status: z.enum(['pendente', 'concluido', 'reagendado', 'cancelado']).default('pendente'), notes: z.string().optional() });
export type FollowUpFormData = z.infer<typeof followUpSchema>;
export const activitySchema = z.object({ title: z.string().min(2), description: z.string().optional(), contactId: z.string().optional(), type: z.enum(['ligacao', 'whatsapp', 'reuniao', 'visita', 'videochamada', 'apresentacao', 'retorno']), owner: z.string().min(2), date: z.string().min(1), time: z.string().min(1), durationMinutes: z.coerce.number().min(5), location: z.string().optional(), status: z.enum(['agendado', 'realizado', 'cancelado']).default('agendado'), notes: z.string().optional() });
export type ActivityFormData = z.infer<typeof activitySchema>;
