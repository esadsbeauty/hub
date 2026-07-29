import { Bell, Command, LogOut, Plus, Search, UserCircle } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/providers/auth-provider';

const labels: Record<string, string> = { crm: 'CRM', agenda: 'Agenda', clientes: 'Clientes', financeiro: 'Financeiro', marketing: 'Marketing', ia: 'IA', relatorios: 'Relatórios', configuracoes: 'Configurações' };

export function Topbar() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  return <header className="sticky top-0 z-20 border-b bg-background/85 px-4 py-3 backdrop-blur-xl md:px-8"><div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between"><div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span>ESADS Beauty</span>{segments.map((segment) => <span key={segment} className="before:mr-2 before:content-['/']">{labels[segment] ?? segment}</span>)}</div><h2 className="mt-1 font-bold">{segments.length ? labels[segments[0]] ?? 'Hub Interno' : 'Dashboard'}</h2></div><div className="flex flex-1 flex-wrap items-center justify-end gap-2"><div className="relative min-w-64 flex-1 xl:max-w-md"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16}/><Input className="h-10 pl-9" placeholder="Busca global: empresa, contato, telefone, tag..." /></div><Button variant="outline" size="sm"><Command size={16}/> Ações rápidas</Button><Button variant="outline" size="sm"><Plus size={16}/> Novo</Button><Button variant="ghost" size="sm"><Bell size={17}/></Button><div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm"><UserCircle size={18}/><span className="hidden md:inline">{user?.email ?? 'Admin preview'}</span></div><Button variant="ghost" size="sm" onClick={signOut}><LogOut size={16}/></Button></div></div></header>;
}
