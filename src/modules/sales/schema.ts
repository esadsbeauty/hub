import{z}from"zod";
export const salesLeadSchema=z.object({name:z.string().trim().min(2,"Informe seu nome."),whatsapp:z.string().transform(value=>value.replace(/\D/g,"")).pipe(z.string().min(10,"Informe um WhatsApp válido.").max(13,"Informe um WhatsApp válido.")),email:z.string().trim().email("Informe um e-mail válido."),businessName:z.string().trim().min(2,"Informe o nome do negócio."),website:z.string().max(0).optional()});
export type SalesLeadInput=z.input<typeof salesLeadSchema>;
