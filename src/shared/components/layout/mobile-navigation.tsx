import { useState } from "react";
import { BarChart3, BookOpen, Calendar, ClipboardCheck, Handshake, Home, Menu, Megaphone, Plus, ShieldCheck, Settings, UserPlus, Users, Wallet } from "lucide-react";
import { Link, NavLink } from "react-router-dom";
import { useAppState } from "@/shared/state/app-state-context";
import { BrandLogo } from "@/shared/components/brand/brand-logo";

const navigation = [
  { to: "/", label: "Início", icon: Home, permission: "dashboard.view" as const },
  { to: "/crm", label: "CRM", icon: Handshake, permission: "crm.view" as const },
  { to: "/agenda", label: "Agenda", icon: Calendar, permission: "agenda.view" as const },
];
const more = [
  { to: "/clientes", label: "Clientes", icon: Users, permission: "customers.view" as const },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, permission: "finance.view" as const },
  { to: "/marketing", label: "Marketing", icon: Megaphone, permission: "marketing.view" as const },
  { to: "/marketing/diagnosticos", label: "Diagnósticos", icon: ClipboardCheck, permission: "marketing.view" as const },
  { to: "/marketing/blog", label: "Blog", icon: BookOpen, permission: "blog.view" as const },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, permission: "reports.view" as const },
  { to: "/configuracoes", label: "Configurações", icon: Settings, permission: "settings.view" as const },
];
const actions = [
  { label: "Nova empresa", detail: "Cadastre um lead com nome e contato", to: "/crm?new=company&quick=1", icon: UserPlus },
  { label: "Nova oportunidade", detail: "Adicione ao pipeline", to: "/crm?new=opportunity", icon: Handshake },
  { label: "Novo follow-up", detail: "Programe o próximo contato", to: "/agenda?new=follow_up", icon: Calendar },
  { label: "Nova tarefa", detail: "Organize uma ação", to: "/agenda?new=task", icon: Plus },
];

export function MobileNavigation() {
  const { can, isPlatformAdmin } = useAppState();
  const [sheet, setSheet] = useState<"new" | "more" | null>(null);
  const navItem = (item: (typeof navigation)[number]) => {
    const Icon = item.icon;
    return can(item.permission) && (
      <NavLink end={item.to === "/"} key={item.to} to={item.to} className={({ isActive }) => `flex min-h-[var(--mobile-bottom-nav-height)] flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
        <Icon size={23} strokeWidth={1.8}/><span>{item.label}</span>
      </NavLink>
    );
  };
  return <>
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border/60 bg-card/95 px-2 pt-1.5 shadow-[0_-12px_40px_rgba(25,20,15,.06)] backdrop-blur-xl lg:hidden pb-[max(.3rem,env(safe-area-inset-bottom))]">
      {navItem(navigation[0])}{navItem(navigation[1])}
      <button aria-label="Abrir ações rápidas" onClick={() => setSheet("new")} className="mx-auto -mt-4 grid h-16 w-16 place-items-center rounded-[1.25rem] border-4 border-background bg-primary text-primary-foreground shadow-overlay premium-focus"><Plus size={28}/></button>
      {navItem(navigation[2])}
      <button onClick={() => setSheet("more")} className="flex min-h-[var(--mobile-bottom-nav-height)] flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold text-muted-foreground premium-focus"><Menu size={23}/><span>Mais</span></button>
    </nav>
    {sheet && <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] lg:hidden" onClick={() => setSheet(null)}>
      <section role="dialog" aria-modal="true" aria-label={sheet === "new" ? "Ações rápidas" : "Mais opções"} className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-auto rounded-t-[1.75rem] bg-card px-4 pt-3 shadow-overlay pb-[max(1.5rem,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border"/>
        <BrandLogo compact/>
        <h2 className="mt-1 text-xl font-semibold tracking-[-.035em]">{sheet === "new" ? "O que deseja criar?" : "Mais opções"}</h2>
        <div className="mt-4 grid gap-1.5">
          {sheet === "more" && isPlatformAdmin && <Link onClick={() => setSheet(null)} className="flex min-h-14 items-center gap-3 rounded-2xl px-3 text-base font-semibold premium-focus active:bg-muted" to="/plataforma"><ShieldCheck size={24}/>Plataforma</Link>}
          {sheet === "new" ? actions.map(({label, detail, to, icon: Icon}) => <Link onClick={() => setSheet(null)} className="flex min-h-16 items-center gap-3 rounded-2xl border border-border/60 px-4 py-3 premium-focus active:bg-muted" key={to} to={to}><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-champagne-soft"><Icon size={23}/></span><span><b className="block text-base">{label}</b><span className="text-sm leading-5 text-muted-foreground">{detail}</span></span></Link>) : more.filter((item) => can(item.permission)).map(({to,label,icon:Icon}) => <Link onClick={() => setSheet(null)} className="flex min-h-14 items-center gap-3 rounded-2xl px-3 text-base font-semibold premium-focus active:bg-muted" key={to} to={to}><Icon size={21}/>{label}</Link>)}
        </div>
      </section>
    </div>}
  </>;
}
