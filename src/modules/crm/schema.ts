import { z } from 'zod';

const optionalText = z.string().trim().optional();
const optionalEmail = z.string().trim().email('Email inválido').optional().or(z.literal(''));

export const companySchema = z.object({
  fantasyName: z.string().trim().min(2, 'Informe o nome fantasia'), legalName: optionalText, cnpj: optionalText, phone: optionalText, whatsapp: optionalText,
  instagram: optionalText, facebook: optionalText, website: optionalText, email: optionalEmail, zipCode: optionalText, address: optionalText, number: optionalText,
  complement: optionalText, district: optionalText, city: optionalText, state: z.string().trim().max(2).optional(), responsibleName: optionalText, responsibleRole: optionalText,
  employees: z.number().min(0).optional(), businessArea: optionalText, leadSource: optionalText, owner: optionalText, temperature: z.enum(['frio', 'morno', 'quente']),
  priority: z.enum(['baixa', 'media', 'alta']), notes: optionalText, tags: optionalText,
});
export type CompanyFormData = z.infer<typeof companySchema>;

export const contactSchema = z.object({ name: z.string().trim().min(2, 'Informe o nome'), role: optionalText, phone: optionalText, whatsapp: optionalText, email: optionalEmail, instagram: optionalText, linkedin: optionalText, birthDate: optionalText, notes: optionalText, isPrimary: z.boolean(), isFinancial: z.boolean(), isCommercial: z.boolean(), status: z.enum(['ativo', 'inativo']) });
export type ContactFormData = z.infer<typeof contactSchema>;
export const followUpSchema = z.object({ title: z.string().trim().min(2, 'Informe o título'), description: optionalText, date: z.string().min(1, 'Informe a data'), time: z.string().min(1, 'Informe a hora'), owner: z.string().trim().min(2, 'Informe o responsável'), priority: z.enum(['baixa', 'media', 'alta']), type: z.enum(['ligacao', 'whatsapp', 'email', 'reuniao', 'proposta', 'outro']), status: z.enum(['pendente', 'concluido', 'reagendado', 'cancelado']), notes: optionalText });
export type FollowUpFormData = z.infer<typeof followUpSchema>;
export const activitySchema = z.object({ title: z.string().trim().min(2, 'Informe o título'), description: optionalText, contactId: optionalText, type: z.enum(['ligacao', 'whatsapp', 'reuniao', 'visita', 'videochamada', 'apresentacao', 'retorno']), owner: z.string().trim().min(2, 'Informe o responsável'), date: z.string().min(1, 'Informe a data'), time: z.string().min(1, 'Informe a hora'), durationMinutes: z.number().min(5), location: optionalText, status: z.enum(['agendado', 'realizado', 'cancelado']), notes: optionalText });
export type ActivityFormData = z.infer<typeof activitySchema>;
