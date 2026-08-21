import { ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

export function BlogDiagnosticCta({ placement = "middle" }: { placement?: "middle" | "final" }) {
  const location = useLocation();
  const destination = `/diagnostico${location.search}`;
  const final = placement === "final";
  return <aside className={`my-12 rounded-[1.75rem] p-7 md:p-10 ${final ? "bg-primary text-primary-foreground" : "border border-champagne/30 bg-champagne-soft/55"}`}>
    <p className={`text-xs font-bold uppercase tracking-[.18em] ${final ? "text-white/55" : "text-champagne-dark"}`}>{final ? "Seu próximo passo" : "Diagnóstico gratuito"}</p>
    <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-[-.035em] md:text-3xl">{final ? "Descubra como está o seu negócio hoje" : "Quer descobrir o que pode estar travando o crescimento do seu negócio?"}</h2>
    <p className={`mt-4 text-base leading-7 ${final ? "text-white/70" : "text-muted-foreground"}`}>{final ? "Faça o diagnóstico da ESADS Beauty e receba uma análise personalizada com seus principais pontos fortes, gargalos e próximos passos." : "Responda algumas perguntas rápidas e receba uma análise do momento atual da sua estética, com os principais pontos que merecem sua atenção."}</p>
    <Link className={`mt-6 inline-flex min-h-12 items-center gap-2 rounded-full px-6 font-semibold ${final ? "bg-white text-black" : "bg-primary text-primary-foreground"}`} to={destination}>{final ? "Quero meu diagnóstico" : "Fazer meu diagnóstico"}<ArrowRight size={18}/></Link>
  </aside>;
}
