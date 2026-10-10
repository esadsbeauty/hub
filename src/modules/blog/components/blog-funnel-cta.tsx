import { ArrowRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { publicEventNames, trackPublicEvent } from "@/shared/analytics/public-events";
import type { BlogPost } from "../types";
export function BlogFunnelCta({ post }: { post: BlogPost }) {
 const location = useLocation();
 return <aside className="my-12 rounded-[1.5rem] bg-primary p-6 text-primary-foreground sm:p-8">
  <p className="text-xs font-bold uppercase tracking-[.16em] text-white/70">Próximo passo</p>
  <h2 className="mt-3 text-2xl font-semibold leading-tight">Quer identificar onde sua clínica pode estar perdendo agendamentos?</h2>
  <p className="mt-3 text-base leading-7 text-white/80">Responda ao diagnóstico gratuito da ESADS Beauty e descubra quais pontos do seu atendimento merecem mais atenção.</p>
  <Link onClick={()=>trackPublicEvent(publicEventNames.blogCtaClick,{kind:"diagnostic",postId:post.id})} className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-black" to={`/diagnostico${location.search}`}>Fazer diagnóstico gratuito <ArrowRight size={18}/></Link>
 </aside>;
}
