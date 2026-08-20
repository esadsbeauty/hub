import { Bell, Plus, Search, UserCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/shared/state/app-state-context";
import { useAuth } from "@/providers/auth-context";

export function Topbar() {
  const { can } = useAppState();
  const { user, appMode, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileSearch, setMobileSearch] = useState("");
  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const query = mobileSearch.trim();
    navigate(query ? `/crm?q=${encodeURIComponent(query)}` : "/crm");
  };
  const actions = [
    { label: "Empresa", to: "/crm?new=company&quick=1", show: can("crm.manage") },
    { label: "Oportunidade", to: "/crm?new=opportunity", show: can("crm.manage") },
    { label: "Follow-up", to: "/agenda?new=follow_up", show: can("crm.manage") },
    { label: "Tarefa", to: "/agenda?new=task", show: can("crm.manage") },
  ];
  return <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-[1.125rem] pb-5 pt-[max(1rem,env(safe-area-inset-top))] min-[430px]:px-5 backdrop-blur-xl md:px-6 md:py-3 lg:px-8">
    <div className="mx-auto max-w-[90rem]">
      <div className="flex items-center gap-3">
        <div className="text-lg font-bold tracking-[.2em] lg:hidden">ESADS</div>
        {appMode === "local" && <span title="Os dados ficam somente neste navegador" className="rounded-full bg-champagne-soft px-2.5 py-1 text-[11px] font-semibold">Modo local</span>}
        <div className="relative hidden flex-1 sm:block sm:max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17}/><Input className="border-transparent bg-muted/70 pl-10 shadow-none focus-visible:bg-card" placeholder="Buscar empresa, contato ou telefone…"/></div>
        <div className="ml-auto flex items-center gap-1.5">
          <details className="relative hidden sm:block"><summary className="flex h-11 cursor-pointer list-none items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus size={17}/> Novo</summary><nav className="absolute right-0 mt-2 grid w-52 gap-1 rounded-2xl bg-card p-2 shadow-overlay">{actions.filter((action) => action.show).map((action) => <Link key={action.label} className="rounded-xl px-3 py-3 text-sm hover:bg-muted" to={action.to}>{action.label}</Link>)}</nav></details>
          <Button variant="ghost" size="sm" aria-label="Notificações"><Bell size={22}/></Button>
          <details className="relative"><summary className="grid h-12 w-12 cursor-pointer list-none place-items-center rounded-full bg-card shadow-soft md:h-11 md:w-11"><UserCircle size={25}/></summary><div className="absolute right-0 mt-2 w-64 rounded-2xl bg-card p-3 shadow-overlay"><p className="truncate text-sm font-medium">{user?.email ?? "Equipe ESADS"}</p><Link className="mt-3 block rounded-xl px-3 py-3 text-sm hover:bg-muted" to="/configuracoes">Meu perfil</Link><button className="min-h-11 w-full rounded-xl px-3 text-left text-sm text-danger hover:bg-muted" onClick={() => void signOut()}>Sair</button></div></details>
        </div>
      </div>
      <form onSubmit={submitSearch} className="mt-4 grid grid-cols-[1fr_auto] gap-2.5 sm:hidden">
        <label className="relative"><span className="sr-only">Buscar no CRM</span><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={19}/><Input value={mobileSearch} onChange={(event)=>setMobileSearch(event.target.value)} enterKeyHint="search" className="border-transparent bg-card pl-11 shadow-soft" placeholder="Buscar lead…"/></label>
        <Link to="/crm?new=company&quick=1" className="inline-flex min-h-[3.25rem] items-center gap-2 rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground shadow-soft"><Plus size={20}/> Novo</Link>
      </form>
    </div>
  </header>;
}
