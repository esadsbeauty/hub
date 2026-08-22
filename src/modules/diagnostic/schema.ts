import { z } from "zod";
import { normalizeInstagram, normalizeWhatsapp } from "../crm/utils/contact-normalizers";
export const diagnosticLeadSchema = z.object({
  name: z.string().trim().min(2, "Informe seu nome."),
  whatsapp: z.string().transform(normalizeWhatsapp).pipe(z.string().min(10, "Informe um WhatsApp válido.")),
  instagram: z.string().transform(normalizeInstagram).transform(value=>value.replace(/^@/, "").toLowerCase()).pipe(z.string().min(2, "Informe seu Instagram.")),
});
export const diagnosticCaptureSchema = diagnosticLeadSchema.extend({ website: z.string().max(0).optional() });
export type DiagnosticCaptureForm = z.input<typeof diagnosticCaptureSchema>;
export function formatBrazilianWhatsapp(value:string){const digits=value.replace(/\D/g,"").replace(/^55(?=\d{10,11}$)/,"").slice(0,11);if(digits.length<=2)return digits;if(digits.length<=6)return`(${digits.slice(0,2)}) ${digits.slice(2)}`;if(digits.length<=10)return`(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;return`(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`}
