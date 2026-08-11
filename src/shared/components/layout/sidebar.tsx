import { NavLink } from 'react-router-dom';
import { BarChart3, Calendar, Handshake, LayoutDashboard, Megaphone, Settings, Users, Wallet } from 'lucide-react';
import type { Permission } from '@/shared/permissions/permissions';
import { useAppState } from '@/shared/state/app-state';

const items = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard.view' },
  { to: '/crm', label: 'CRM', icon: Handshake, permission: 'crm.view' },
  { to: '/agenda', label: 'Agenda', icon: Calendar, permission: 'agenda.view' },
  { to: '/clientes', label: 'Clientes', icon: Users, permission: 'customers.view' },
  { to: '/financeiro', label: 'Financeiro', icon: Wallet, permission: 'finance.view' },
  { to: '/marketing', label: 'Marketing', icon: Megaphone, permission: 'marketing.view' },
  { to: '/relatorios', label: 'Relatórios', icon: BarChart3, permission: 'reports.view' },
  { to: '/configuracoes', label: 'Configurações', icon: Settings, permission: 'settings.view' },
] satisfies { to: string; label: string; icon: typeof LayoutDashboard; permission: Permission }[];

export function Sidebar() {
  const { can } = useAppState();
  return <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-white/75 p-4 backdrop-blur-xl dark:bg-black/30 lg:block"><div className="px-3 py-4"><p className="text-xs font-bold uppercase tracking-[.35em] text-champagne-dark">ESADS</p><h1 className="text-xl font-extrabold">Beauty Hub</h1></div><nav className="mt-6 space-y-1">{items.filter((item) => can(item.permission)).map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold smooth ${isActive ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon size={18}/>{label}</NavLink>)}</nav></aside>;
}
