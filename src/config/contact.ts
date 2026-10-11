const whatsapp =
  (import.meta.env.VITE_WHATSAPP_NUMBER as string | undefined)?.replace(/\D/g, "") ?? "";

export const privacyContactEmail = "contato@esads.com.br";
export const generalContactEmail = "contato@esads.com.br";

export function supportWhatsappUrl(message: string) {
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
}

export function diagnosticWhatsappUrl(name: string, score: number) {
  const text = `Olá! Fiz o Diagnóstico do meu Negócio da ESADS Beauty. Meu nome é ${name} e meu resultado foi ${score}/100. Gostaria de conversar sobre o resultado.`;

  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
}
/** Convite de consultoria após diagnóstico; apenas inicia uma conversa, não agenda automaticamente. */
export function diagnosticConsultationUrl(input: { name: string; score: number; stage: string; need: string; bottleneck: string; sourceUrl: string }) {
  const text = [
    "Olá! Concluí o diagnóstico da ESADS Beauty e tenho interesse em uma consultoria estratégica para entender como melhorar meu negócio.",
    `Nome: ${input.name}`,
    `Resultado: ${input.score}/100`,
    `Momento do negócio: ${input.stage}`,
    `Objetivo: ${input.need}`,
    `Ponto de atenção: ${input.bottleneck}`,
    `Diagnóstico: ${input.sourceUrl}`,
    "Podemos conversar sobre os próximos passos?",
  ].join("\\n");
  return `https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`;
}
