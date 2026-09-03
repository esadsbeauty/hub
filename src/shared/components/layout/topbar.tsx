import { Bell, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-context";
import { UserAvatar } from "@/shared/components/data-display/user-avatar";
import { useCurrentUserProfile } from "@/modules/profile/hooks";
import { TenantSwitcher } from "./tenant-switcher";

type ProfileProps = {
  name?: string;
  email?: string;
  avatarUrl?: string;
  signOut: () => Promise<void>;
};

export function Topbar() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const profile = useCurrentUserProfile().data;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const query = search.trim();
    navigate(query ? `/crm?q=${encodeURIComponent(query)}` : "/crm");
  };

  const identity = {
    name: profile?.name,
    email: profile?.email ?? auth.user?.email,
    avatarUrl: profile?.avatarUrl,
    local: auth.appMode === "local",
    signOut: auth.signOut,
  };

  return (
    <>
      <MobileHeader
        search={search}
        setSearch={setSearch}
        submit={submit}
        {...identity}
      />
      <DesktopHeader {...identity} />
    </>
  );
}

function MobileHeader({
  search,
  setSearch,
  submit,
  name,
  email,
  avatarUrl,
  local,
  signOut,
}: ProfileProps & {
  search: string;
  setSearch: (value: string) => void;
  submit: (event: FormEvent) => void;
  local: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-4 pb-4 pt-[max(.75rem,env(safe-area-inset-top))] backdrop-blur-xl min-[430px]:px-5 md:hidden">
      <div className="flex min-h-11 items-center">
        <div>
          <div className="text-sm font-bold tracking-[.16em]">
            ESADS BEAUTY
          </div>
          <div className="text-[10px] font-semibold tracking-[.28em] text-muted-foreground">
            CRM
          </div>
        </div>

        {local && (
          <span className="ml-3 rounded-full bg-champagne-soft px-2.5 py-1 text-sm font-semibold">
            Local
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="ghost" size="sm" aria-label="Notificações">
            <Bell size={21} />
          </Button>

          <Profile
            name={name}
            email={email}
            avatarUrl={avatarUrl}
            signOut={signOut}
          />
        </div>
      </div>

      <div className="mt-3">
        <TenantSwitcher />
      </div>

      <form onSubmit={submit} className="mt-3">
        <label className="relative block">
          <span className="sr-only">Buscar no CRM</span>

          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground"
            size={19}
          />

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            enterKeyHint="search"
            className="border-transparent bg-card pl-11 text-base shadow-soft"
            placeholder="Buscar empresa ou contato…"
          />
        </label>
      </form>
    </header>
  );
}

function DesktopHeader({
  name,
  email,
  avatarUrl,
  local,
  signOut,
}: ProfileProps & { local: boolean }) {
  return (
    <header className="sticky top-0 z-20 hidden border-b border-border/60 bg-background/95 px-5 py-3 backdrop-blur-xl md:block lg:px-8">
      <div className="mx-auto flex max-w-[90rem] min-w-0 items-center gap-3">
        {local && (
          <span className="shrink-0 rounded-full bg-champagne-soft px-2.5 py-1 text-[11px] font-semibold">
            Modo local
          </span>
        )}

        <div className="min-w-0 flex-1">
          <TenantSwitcher />
        </div>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" aria-label="Notificações">
            <Bell size={20} />
          </Button>

          <Profile
            name={name}
            email={email}
            avatarUrl={avatarUrl}
            signOut={signOut}
          />
        </div>
      </div>
    </header>
  );
}

function Profile({
  name,
  email,
  avatarUrl,
  signOut,
}: ProfileProps) {
  return (
    <details className="relative">
      <summary
        aria-label="Abrir menu do perfil"
        className="cursor-pointer list-none rounded-full shadow-soft"
      >
        <UserAvatar
          name={name}
          email={email}
          src={avatarUrl}
        />
      </summary>

      <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-card p-3 shadow-overlay">
        <p className="truncate text-sm font-semibold">
          {name ?? "Equipe ESADS"}
        </p>

        <p className="truncate text-xs text-muted-foreground">
          {email}
        </p>

        <Link
          className="mt-3 block rounded-xl px-3 py-3 text-sm hover:bg-muted"
          to="/configuracoes"
        >
          Meu perfil
        </Link>

        <button
          className="min-h-12 w-full rounded-xl px-3 text-left text-sm text-danger hover:bg-muted"
          onClick={() => void signOut()}
        >
          Sair
        </button>
      </div>
    </details>
  );
}