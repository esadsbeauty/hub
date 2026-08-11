import { Bell, Command, LogOut, Plus, Search, UserCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/providers/auth-provider";

const labels: Record<string, string> = {
  crm: "CRM",
  agenda: "Agenda",
  clientes: "Clientes",
  financeiro: "Financeiro",
  marketing: "Marketing",
  ia: "IA",
  relatorios: "Relatórios",
  configuracoes: "Configurações",
};

export function Topbar() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const segments = location.pathname.split("/").filter(Boolean);
  return (
    <header className="sticky top-0 z-20 border-b bg-background/85 px-4 py-3 backdrop-blur-xl md:px-8">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>ESADS Beauty</span>
            {segments.map((segment) => (
              <span key={segment} className="before:mr-2 before:content-['/']">
                {labels[segment] ?? segment}
              </span>
            ))}
          </div>
          <h2 className="mt-1 font-bold">
            {segments.length
              ? (labels[segments[0]] ?? "Hub Interno")
              : "Dashboard"}
          </h2>
        </div>
        <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
          <div className="relative min-w-64 flex-1 xl:max-w-md">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              size={16}
            />
            <Input
              className="h-10 pl-9"
              placeholder="Busca global: empresa, contato, telefone, tag..."
            />
          </div>
          <details className="relative">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-xl border px-3 text-sm font-semibold hover:bg-muted">
              <Command size={16} /> Ações rápidas
            </summary>
            <nav className="absolute right-0 mt-2 grid w-52 gap-1 rounded-xl border bg-card p-2 shadow-premium">
              <Link
                className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
                to="/crm"
              >
                Nova empresa
              </Link>
              <Link
                className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
                to="/crm"
              >
                Nova oportunidade
              </Link>
              <Link
                className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
                to="/agenda?new=follow_up"
              >
                Novo follow-up
              </Link>
              <Link
                className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
                to="/agenda?new=task"
              >
                Nova tarefa
              </Link>
              <Link
                className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
                to="/agenda?new=meeting"
              >
                Nova reunião
              </Link>
            </nav>
          </details>
          <Link
            className="inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-semibold hover:bg-muted"
            to="/agenda"
          >
            <Plus size={16} /> Novo
          </Link>
          <Button variant="ghost" size="sm" aria-label="Notificações">
            <Bell size={17} />
          </Button>
          <div className="flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm">
            <UserCircle size={18} />
            <span className="hidden md:inline">
              {user?.email ?? "Admin preview"}
            </span>
          </div>
          <Button variant="ghost" size="sm" aria-label="Sair" onClick={signOut}>
            <LogOut size={16} />
          </Button>
        </div>
      </div>
    </header>
  );
}
