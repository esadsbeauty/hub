const whatsapp=(import.meta.env.VITE_WHATSAPP_NUMBER as string|undefined)?.replace(/\D/g,"")??"";
export function diagnosticWhatsappUrl(name:string,score:number){const text=`Olá! Fiz o Diagnóstico do meu Negócio da ESADS Beauty. Meu nome é ${name} e meu resultado foi ${score}/100. Gostaria de conversar sobre o resultado.`;return`https://wa.me/${whatsapp}?text=${encodeURIComponent(text)}`}
