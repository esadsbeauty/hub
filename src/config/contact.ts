export const ESADS_WHATSAPP_LOCAL_NUMBER = "75991355513";
export const ESADS_WHATSAPP_NUMBER = `55${ESADS_WHATSAPP_LOCAL_NUMBER}`;
export const ESADS_WHATSAPP_URL = `https://wa.me/${ESADS_WHATSAPP_NUMBER}`;

export function officialWhatsappUrl(message?: string) {
  return message ? `${ESADS_WHATSAPP_URL}?text=${encodeURIComponent(message)}` : ESADS_WHATSAPP_URL;
}

export function diagnosticWhatsappUrl(name:string,score:number){const text=`Olá! Fiz o Diagnóstico do meu Negócio da ESADS Beauty. Meu nome é ${name} e meu resultado foi ${score}/100. Gostaria de conversar sobre o resultado.`;return officialWhatsappUrl(text)}
