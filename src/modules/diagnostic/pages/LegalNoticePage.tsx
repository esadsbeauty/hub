import { Link, useLocation } from "react-router-dom";
import { SeoHead } from "@/modules/blog/components/seo-head";

export function LegalNoticePage() {
  const privacy = useLocation().pathname === "/privacidade";
  const title = privacy ? "Política de Privacidade" : "Termos de Uso";
  return <>
    <SeoHead title={`${title} | ESADS Beauty`} description={privacy ? "Política de privacidade e tratamento de dados do ESADS Beauty." : "Termos de uso dos serviços públicos do ESADS Beauty."} path={privacy ? "/privacidade" : "/termos"}/>
    <main className="mx-auto max-w-3xl px-5 py-16 md:px-8 md:py-24">
      <p className="text-sm font-bold uppercase tracking-[.16em] text-champagne-dark">ESADS Beauty</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-.045em]">{title}</h1>
      <p className="mt-6 text-lg leading-8 text-muted-foreground">{privacy ? "As informações enviadas no diagnóstico são usadas para entregar o resultado, registrar sua solicitação e permitir o contato da equipe ESADS Beauty. Não disponibilizamos seus dados publicamente." : "O diagnóstico oferece uma orientação inicial baseada nas respostas informadas. Ele não substitui uma análise financeira, contábil ou jurídica profissional."}</p>
      <p className="mt-4 text-lg leading-8 text-muted-foreground">Para solicitar informações, correção ou exclusão dos seus dados, entre em contato com a ESADS Beauty pelos canais oficiais.</p>
      <Link className="mt-8 inline-flex min-h-14 items-center rounded-xl bg-primary px-6 font-semibold text-primary-foreground" to="/diagnostico">Voltar ao diagnóstico</Link>
    </main>
  </>;
}
