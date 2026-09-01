import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  ClipboardCheck,
  Handshake,
  LayoutDashboard,
  LogOut,
  Megaphone,
  ShieldCheck,
  Settings,
  UserRoundSearch,
  Users,
  Wallet,
} from "lucide-react";
import type { Permission } from "@/shared/permissions/permissions";
import { useAppState } from "@/shared/state/app-state-context";
import { useAuth } from "@/providers/auth-context";
import { BrandLogo } from "@/shared/components/brand/brand-logo";

export const navigationItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { to: "/crm", label: "CRM", icon: Handshake, permission: "crm.view" },
  { to: "/agenda", label: "Agenda", icon: Calendar, permission: "agenda.view" },
  { to: "/clientes", label: "Clientes", icon: Users, permission: "customers.view" },
  { to: "/financeiro", label: "Financeiro", icon: Wallet, permission: "finance.view" },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3, permission: "reports.view" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, permission: "settings.view" },
] satisfies { to: string; label: string; icon: typeof LayoutDashboard; permission: Permission }[];

const roleNames = { owner: "Administrador principal", admin: "Administrador", manager: "Gestor", sales: "Comercial", operations: "Operacional", financial: "Financeiro", marketing: "Marketing", reader: "Leitura" };
const linkClass = ({ isActive }: { isActive: boolean }) => `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-white/[.09] text-white before:absolute before:-left-1 before:h-5 before:w-0.5 before:rounded-full before:bg-champagne" : "text-white/55 hover:bg-white/[.055] hover:text-white/90"}`;

export function SidebarNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const { can, isPlatformAdmin } = useAppState();
  const { pathname } = useLocation();
  const [marketingOpen, setMarketingOpen] = useState(pathname.startsWith("/marketing"));
  const [platformOpen, setPlatformOpen] = useState(pathname.startsWith("/plataforma"));
  const mainBeforeMarketing = navigationItems.slice(0, 5);
  const mainAfterMarketing = navigationItems.slice(5);
  const renderLink = ({ to, label, icon: Icon, permission }: (typeof navigationItems)[number]) => can(permission) && <NavLink end={to === "/"} onClick={onNavigate} key={to} to={to} className={linkClass}><Icon size={17} strokeWidth={1.7}/>{label}</NavLink>;
  return <nav className="space-y-1" aria-label="Navegação lateral">
    {mainBeforeMarketing.map(renderLink)}
    {can("marketing.view") && <NavGroup label="Marketing" icon={Megaphone} open={marketingOpen} setOpen={setMarketingOpen} active={pathname.startsWith("/marketing")}>
      <NavLink onClick={onNavigate} to="/marketing" className={linkClass}>Visão Geral / Marketing</NavLink>
      <NavLink onClick={onNavigate} to="/marketing/diagnosticos" className={linkClass}><ClipboardCheck size={16}/>Diagnósticos</NavLink>
      {can("blog.view") && <NavLink onClick={onNavigate} to="/marketing/blog" className={linkClass}><BookOpen size={16}/>Blog</NavLink>}
    </NavGroup>}
    {mainAfterMarketing.map(renderLink)}
    {isPlatformAdmin && <NavGroup label="Plataforma" icon={ShieldCheck} open={platformOpen} setOpen={setPlatformOpen} active={pathname.startsWith("/plataforma")}>
      <NavLink end onClick={onNavigate} to="/plataforma" className={linkClass}>Visão geral</NavLink>
      <NavLink onClick={onNavigate} to="/plataforma/leads" className={linkClass}><UserRoundSearch size={16}/>Leads de Produto</NavLink>
      <NavLink onClick={onNavigate} to="/plataforma/organizacoes" className={linkClass}><Building2 size={16}/>Organizações</NavLink>
    </NavGroup>}
  </nav>;
}

function NavGroup({ label, icon: Icon, open, setOpen, active, children }: { label: string; icon: typeof LayoutDashboard; open: boolean; setOpen: (value: boolean) => void; active: boolean; children: React.ReactNode }) {
  return <div>
    <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${active ? "text-white" : "text-white/55 hover:bg-white/[.055] hover:text-white/90"}`}>
      <Icon size={17}/><span className="flex-1 text-left">{label}</span><ChevronDown size={15} className={`transition-transform ${open ? "rotate-180" : ""}`}/>
    </button>
    {open && <div className="ml-4 space-y-1 border-l border-white/10 pl-2">{children}</div>}
  </div>;
}

export function Sidebar() {
  const { user, signOut } = useAuth();
  const { role } = useAppState();
  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col overflow-hidden bg-sidebar text-white lg:flex">
    <div className="shrink-0 px-7 pb-5 pt-5"><BrandLogo className="w-36"/><p className="mt-3 text-xs text-white/40">Hub Interno</p></div>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 [scrollbar-width:thin]"><SidebarNavigation/></div>
    <div className="shrink-0 border-t border-white/10 bg-sidebar px-6 py-4"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-xs font-semibold">{(user?.email?.[0] ?? "E").toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-medium">{user?.email ?? "Equipe ESADS"}</p><p className="mt-0.5 text-[11px] text-white/40">{roleNames[role]}</p></div><button className="rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white" aria-label="Sair" onClick={() => void signOut()}><LogOut size={15}/></button></div></div>
  </aside>;
}
