import { useState } from "react";
import { Calendar, LayoutDashboard, Menu, Plus, Users, Handshake, Wallet, Megaphone, BarChart3, Settings } from "lucide-react";
import { NavLink, Link } from "react-router-dom";
import { useAppState } from "@/shared/state/app-state-context";

const primary = [
  { to: "/", label: "Início", icon: LayoutDashboard, permission: "dashboard.view" as const },
  { to: "/crm", label: "CRM", icon: Handshake, permission: "crm.view" as const },
  { to: "/agenda", label: "Agenda", icon: Calendar, permission: "agenda.view" as const },
  { to: "/clientes", label: "Clientes", icon: Users, permission: "customers.view" as const },
];
const more = [
  { to: "/financeiro", label: "Financeiro", icon: Wallet, permission: "finance.view" as const },
  { to: "/marketing", label: "Marketing", icon: Megaphone, permission: "marketing.view" as const },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, permission: "reports.view" as const },
  { to: "/configuracoes", label: "Configurações", icon: Settings, permission: "settings.view" as const },
];
export function MobileNavigation() {
  const { can } = useAppState(); const [sheet, setSheet] = useState<"new" | "more" | null>(null);
  const actions = [
    ["Novo lead", "/crm?new=company&quick=1"], ["Nova oportunidade", "/crm?new=opportunity"],
    ["Novo follow-up", "/agenda?new=follow_up"], ["Nova tarefa", "/agenda?new=task"], ["Nova reunião", "/agenda?new=meeting"],
  ];
  return <><nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-border/70 bg-card/95 px-1 pt-1 backdrop-blur-xl lg:hidden pb-[max(.35rem,env(safe-area-inset-bottom))]">{primary.slice(0,2).map(({to,label,icon:Icon,permission}) => can(permission) && <NavLink end={to === "/"} key={to} to={to} className={({isActive}) => `flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}><Icon size={19}/>{label}</NavLink>)}<button aria-label="Criar novo" onClick={() => setSheet("new")} className="mx-auto -mt-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-overlay"><Plus size={22}/></button>{primary.slice(2).map(({to,label,icon:Icon,permission}) => can(permission) && <NavLink key={to} to={to} className={({isActive}) => `flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium ${isActive ? "text-foreground" : "text-muted-foreground"}`}><Icon size={19}/>{label}</NavLink>)}<button onClick={() => setSheet("more")} className="flex min-h-14 flex-col items-center justify-center gap-1 text-[10px] font-medium text-muted-foreground"><Menu size={19}/>Mais</button></nav>{sheet && <div className="fixed inset-0 z-50 bg-black/35 lg:hidden" onClick={() => setSheet(null)}><section role="dialog" aria-modal="true" aria-label={sheet === "new" ? "Criar novo" : "Mais opções"} className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-card p-5 shadow-overlay pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}><div className="mx-auto mb-5 h-1 w-10 rounded-full bg-border"/><h2 className="mb-3 text-lg font-semibold">{sheet === "new" ? "Criar novo" : "Mais opções"}</h2><div className="grid gap-1">{sheet === "new" ? actions.map(([label,to]) => <Link onClick={() => setSheet(null)} className="min-h-12 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted" key={to} to={to}>{label}</Link>) : more.filter((item) => can(item.permission)).map(({to,label,icon:Icon}) => <Link onClick={() => setSheet(null)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium hover:bg-muted" key={to} to={to}><Icon size={18}/>{label}</Link>)}</div></section></div>}</>;
}
