import { useMemo, useState } from "react";
import { Building2, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAppState } from "@/shared/state/app-state-context";

export function TenantSwitcher() {
  const state = useAppState();
  const [query, setQuery] = useState("");
  const [switching, setSwitching] = useState(false);
  const organizations = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    return normalized
      ? state.platformOrganizations.filter((item) => `${item.name} ${item.slug}`.toLocaleLowerCase("pt-BR").includes(normalized))
      : state.platformOrganizations;
  }, [query, state.platformOrganizations]);
  if (!state.isPlatformAdmin) return null;
  const select = async (id: string) => {
    if (id === state.organizationId) return;
    setSwitching(true);
    try { await state.switchOrganization(id); setQuery(""); }
    finally { setSwitching(false); }
  };
  return <details className="group relative min-w-0">
    <summary className="flex min-h-11 w-full max-w-[28rem] cursor-pointer list-none items-center gap-2 rounded-xl border bg-card px-3 text-left shadow-soft premium-focus">
      <Building2 className="shrink-0 text-champagne-dark" size={18}/>
      <span className="min-w-0 flex-1"><span className="block text-[10px] font-bold uppercase tracking-[.12em] text-muted-foreground">Organização atual</span><span className="block truncate text-sm font-semibold">{state.organizationName}</span></span>
      <ChevronDown className="shrink-0 transition-transform group-open:rotate-180" size={17}/>
    </summary>
    <div className="absolute left-0 z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border bg-card p-3 shadow-overlay">
      <label className="relative block"><span className="sr-only">Pesquisar organização</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17}/><Input value={query} onChange={(event)=>setQuery(event.target.value)} className="pl-10" placeholder="Pesquisar organização…"/></label>
      <div className="mt-2 max-h-72 overflow-y-auto overscroll-contain">
        {organizations.map((item)=><button key={item.id} disabled={switching} onClick={()=>void select(item.id)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-muted disabled:opacity-60"><span className="min-w-0"><span className="block truncate text-sm font-semibold">{item.name}</span><span className="block truncate text-xs text-muted-foreground">{item.slug}{item.type?` · ${item.type}`:""}</span></span>{item.id===state.organizationId&&<span className="text-xs font-semibold text-champagne-dark">Atual</span>}</button>)}
        {!organizations.length&&<p className="p-3 text-sm text-muted-foreground">Nenhuma organização encontrada.</p>}
      </div>
      {state.isImpersonating&&<button disabled={switching} onClick={()=>void select(state.baseOrganizationId)} className="mt-2 min-h-11 w-full rounded-xl bg-primary px-3 text-sm font-semibold text-primary-foreground">Voltar para {state.baseOrganizationName}</button>}
    </div>
  </details>;
}
