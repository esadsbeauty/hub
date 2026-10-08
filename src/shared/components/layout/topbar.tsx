import { Bell, Search } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/providers/auth-context";
import { UserAvatar } from "@/shared/components/data-display/user-avatar";
import { useCurrentUserProfile } from "@/modules/profile/hooks";
import { TenantSwitcher } from "./tenant-switcher";
import {
  useHumanHandoffAlerts,
  type HumanHandoffAlert,
} from "@/modules/notifications/use-human-handoff-alerts";

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
  const humanHandoff = useHumanHandoffAlerts();

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
        alerts={humanHandoff.alerts}
        search={search}
        setSearch={setSearch}
        submit={submit}
        {...identity}
      />
      <DesktopHeader alerts={humanHandoff.alerts} {...identity} />
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
  alerts,
}: ProfileProps & {
  alerts: HumanHandoffAlert[];
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
          <NotificationsBell alerts={alerts} mobile />

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
  alerts,
}: ProfileProps & { local: boolean; alerts: HumanHandoffAlert[] }) {
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
          <NotificationsBell alerts={alerts} />

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

function waitingLabel(minutes: number) {
  if (minutes < 1) return "agora";
  if (minutes === 1) return "há 1 min";
  if (minutes < 60) return `há ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (rest === 0) {
    return hours === 1 ? "há 1 h" : `há ${hours} h`;
  }

  return `há ${hours}h ${rest}min`;
}

function alertTone(minutes: number) {
  if (minutes >= 15) {
    return "border-red-200 bg-red-50";
  }

  if (minutes >= 5) {
    return "border-amber-200 bg-amber-50";
  }

  return "border-border/60 bg-background";
}

function NotificationsBell({
  alerts,
  mobile = false,
}: {
  alerts: HumanHandoffAlert[];
  mobile?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const ordered = useMemo(
    () =>
      [...alerts].sort(
        (a, b) =>
          b.waitingMinutes -
          a.waitingMinutes,
      ),
    [alerts],
  );

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        aria-label="Notificações"
        aria-expanded={open}
        onClick={() =>
          setOpen(
            (current) => !current,
          )
        }
        className={
          alerts.length
            ? "relative"
            : undefined
        }
      >
        <Bell
          size={
            mobile
              ? 21
              : 20
          }
          className={
            alerts.length
              ? "animate-pulse text-destructive"
              : undefined
          }
        />

        {alerts.length > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground">
            {alerts.length > 9
              ? "9+"
              : alerts.length}
          </span>
        )}
      </Button>

      {open && (
        <div
          className={
            mobile
              ? "fixed left-4 right-4 top-16 z-50 max-h-[70dvh] overflow-auto rounded-2xl border bg-card p-3 shadow-overlay"
              : "absolute right-0 top-[calc(100%+.5rem)] z-50 w-[380px] max-w-[90vw] rounded-2xl border bg-card p-3 shadow-overlay"
          }
        >
          <div className="flex items-center justify-between gap-3 px-1 pb-2">
            <div>
              <p className="font-semibold">
                Notificações
              </p>
              <p className="text-xs text-muted-foreground">
                Atendimento humano
              </p>
            </div>

            {alerts.length > 0 && (
              <span className="rounded-full bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive">
                {alerts.length} aguardando
              </span>
            )}
          </div>

          {ordered.length === 0 ? (
            <div className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              Nenhum lead aguardando atendimento humano.
            </div>
          ) : (
            <div className="space-y-2">
              {ordered.map(
                (alert) => (
                  <button
                    key={
                      alert.opportunityId
                    }
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      sessionStorage.removeItem("crm-query");
                      navigate("/crm");
                    }}
                    className={`w-full rounded-xl border p-3 text-left transition hover:brightness-[.98] ${alertTone(
                      alert.waitingMinutes,
                    )}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {alert.title}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Aguardando atendimento humano
                        </p>
                      </div>

                      <span
                        className={
                          alert.waitingMinutes >= 15
                            ? "shrink-0 text-xs font-semibold text-destructive"
                            : alert.waitingMinutes >= 5
                              ? "shrink-0 text-xs font-semibold text-amber-700"
                              : "shrink-0 text-xs font-medium text-muted-foreground"
                        }
                      >
                        {waitingLabel(
                          alert.waitingMinutes,
                        )}
                      </span>
                    </div>
                  </button>
                ),
              )}
            </div>
          )}

          {ordered.length > 0 && (
            <p className="mt-3 px-1 text-[11px] leading-4 text-muted-foreground">
              O alerta só some quando o lead sair da etapa Atendimento humano.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
