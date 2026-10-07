import { z } from "zod";

const optionalText = z.string().trim().optional();
const optionalEmail = z
  .string()
  .trim()
  .email("Email inválido")
  .optional()
  .or(z.literal(""));
const optionalPhone = z
  .string()
  .trim()
  .refine(
    (value) => !value || value.replace(/\D/g, "").length >= 8,
    "Informe um telefone válido",
  )
  .optional();

export const companySchema = z.object({
  fantasyName: z.string().trim().min(2, "Informe o nome fantasia"),
  legalName: optionalText,
  cnpj: optionalText,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  instagram: optionalText,
  facebook: optionalText,
  website: optionalText,
  email: optionalEmail,
  zipCode: optionalText,
  address: optionalText,
  number: optionalText,
  complement: optionalText,
  district: optionalText,
  city: optionalText,
  state: z.string().trim().max(2).optional(),
  responsibleName: optionalText,
  responsibleRole: optionalText,
  employees: z.number().min(0).optional(),
  businessArea: optionalText,
  leadSource: optionalText,
  owner: optionalText,
  ownerId: optionalText,
  temperature: z.enum(["frio", "morno", "quente"]),
  priority: z.enum(["baixa", "media", "alta"]),
  notes: optionalText,
  tags: optionalText,
});
export type CompanyFormData = z.infer<typeof companySchema>;

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome"),
  role: optionalText,
  phone: optionalPhone,
  whatsapp: optionalPhone,
  email: optionalEmail,
  instagram: optionalText,
  linkedin: optionalText,
  birthDate: optionalText,
  notes: optionalText,
  isPrimary: z.boolean(),
  isFinancial: z.boolean(),
  isCommercial: z.boolean(),
  status: z.enum(["ativo", "inativo"]),
});
export type ContactFormData = z.infer<typeof contactSchema>;
export const followUpSchema = z.object({
  title: z.string().trim().min(2, "Informe o título"),
  description: optionalText,
  date: z.string().min(1, "Informe a data"),
  time: z.string().min(1, "Informe a hora"),
  owner: z.string().trim().min(2, "Informe o responsável"),
  priority: z.enum(["baixa", "media", "alta"]),
  type: z.enum([
    "ligacao",
    "whatsapp",
    "email",
    "reuniao",
    "follow_up",
    "task",
  ]),
  status: z.enum(["pendente", "concluido", "reagendado", "cancelado"]),
  notes: optionalText,
});
export type FollowUpFormData = z.infer<typeof followUpSchema>;

export const taskSchema = z.object({
  companyId: z.string().optional(),
  opportunityId: z.string().optional(),
  title: z.string().trim().min(2, "Informe o título").max(120),
  description: optionalText,
  type: z.enum(["follow_up", "call", "whatsapp", "email", "meeting", "task"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignedTo: z.string().min(1, "Selecione o responsável"),
  date: z.string().min(1, "Informe a data"),
  time: z.string().min(1, "Informe o horário"),
  durationMinutes: z.number().min(5).max(1440).optional(),
  locationType: z.enum(["online", "in_person", "phone", "other"]).optional(),
  location: optionalText,
  meetingUrl: z
    .string()
    .url("Informe uma URL válida")
    .optional()
    .or(z.literal("")),
});
export type TaskFormData = z.infer<typeof taskSchema>;
export const activitySchema = z.object({
  title: z.string().trim().min(2, "Informe o título"),
  description: optionalText,
  contactId: optionalText,
  type: z.enum([
    "ligacao",
    "whatsapp",
    "reuniao",
    "visita",
    "videochamada",
    "apresentacao",
    "retorno",
  ]),
  owner: z.string().trim().min(2, "Informe o responsável"),
  date: z.string().min(1, "Informe a data"),
  time: z.string().min(1, "Informe a hora"),
  durationMinutes: z.number().min(5),
  location: optionalText,
  status: z.enum(["agendado", "realizado", "cancelado"]),
  notes: optionalText,
});
export type ActivityFormData = z.infer<typeof activitySchema>;

export const opportunitySchema = z.object({
  companyId: z.string().min(1, "Selecione a empresa"),
  pipelineId: z.string().min(1, "Selecione o pipeline"),
  stageId: z.string().min(1, "Selecione a etapa"),
  title: z
    .string()
    .trim()
    .min(2, "Informe o título")
    .max(120, "Use até 120 caracteres"),
  description: optionalText,
  value: z.number().min(0, "Informe um valor válido"),
  probability: z.number().min(0).max(100),
  expectedCloseDate: optionalText,
  owner: optionalText,
  source: optionalText,
});
export type OpportunityFormData = z.infer<typeof opportunitySchema>;

export const lostOpportunitySchema = z.object({
  reason: z.enum([
    "price",
    "no_response",
    "no_interest",
    "competitor",
    "timing",
    "no_budget",
    "unqualified",
    "other",
  ]),
  notes: z.string().trim().max(500, "Use até 500 caracteres").optional(),
});
export type LostOpportunityFormData = z.infer<typeof lostOpportunitySchema>;
