import { Sparkles } from "lucide-react";

export type DiagnosticPreviewData = {
  score: number;
  status: string;
  summary: string;
  areas: { label: string; score: number }[];
  priority: string;
  priorityDescription: string;
};

export const diagnosticPreviewData: DiagnosticPreviewData = {
  score: 68,
  status: "Em desenvolvimento",
  summary: "Você está no caminho certo, mas alguns pontos precisam de atenção para acelerar seu crescimento.",
  areas: [
    { label: "Captação e vendas", score: 72 },
    { label: "Atendimento", score: 54 },
    { label: "Organização", score: 43 },
    { label: "Financeiro", score: 58 },
  ],
  priority: "Organização comercial",
  priorityDescription: "Melhore seu processo de atendimento e follow-up para aumentar suas conversões.",
};

export function DiagnosticResultPreview({ data = diagnosticPreviewData }: { data?: DiagnosticPreviewData }) {
  return <div className="relative mx-auto w-full max-w-[31rem] md:py-3">
    <div aria-hidden className="absolute -inset-4 -z-10 rounded-[2.25rem] bg-champagne/10 blur-2xl"/>
    <article className="overflow-hidden rounded-[1.75rem] bg-white shadow-[0_24px_70px_-34px_rgba(20,16,10,.28)] ring-1 ring-black/[.045]">
      <header className="flex items-center justify-between border-b border-black/5 px-5 py-4 sm:px-6">
        <div><p className="text-[11px] font-bold uppercase tracking-[.18em] text-champagne-dark">Prévia do resultado</p><h2 className="mt-1 text-xl font-semibold">Seu diagnóstico</h2></div>
        <span className="grid h-10 w-10 place-items-center rounded-full bg-champagne-soft text-champagne-dark"><Sparkles size={19}/></span>
      </header>
      <div className="p-5 sm:p-6">
        <div className="grid grid-cols-[auto_1fr] items-center gap-4">
          <div className="grid h-[5.75rem] w-[5.75rem] place-items-center rounded-full border-[7px] border-champagne-soft bg-champagne-soft/35 text-center"><strong className="text-2xl leading-none">{data.score}%</strong></div>
          <div><p className="text-sm text-muted-foreground">Nível atual do seu negócio</p><p className="mt-1 text-lg font-semibold">{data.status}</p><p className="mt-2 text-sm leading-5 text-muted-foreground">{data.summary}</p></div>
        </div>
        <div className="mt-6 space-y-3.5">{data.areas.map(area=><div key={area.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="font-medium">{area.label}</span><strong>{area.score}%</strong></div><div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={area.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={area.score}><div className="h-full rounded-full bg-champagne" style={{width:`${area.score}%`}}/></div></div>)}</div>
        <div className="mt-6 rounded-2xl bg-primary p-5 text-primary-foreground"><p className="text-[11px] font-bold uppercase tracking-[.17em] text-champagne">Sua prioridade agora</p><h3 className="mt-2 text-xl font-semibold">{data.priority}</h3><p className="mt-2 text-sm leading-6 text-white/65">{data.priorityDescription}</p></div>
      </div>
    </article>
  </div>;
}
