import { Bell, Search } from "lucide-react";
import { useAppState } from "@/shared/state/app-state-context";
import { usePriorityCallAlerts, type PriorityCallAlert } from "@/modules/notifications/use-priority-call-alerts";
import { useMemo, useState, useEffect, type FormEvent } from "react";
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
import {
  useEsadsGrowthAlerts,
  type GrowthAlert,
} from "@/modules/notifications/use-esads-growth-alerts";

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
  const growthAlerts = useEsadsGrowthAlerts();
  const priorityCalls = usePriorityCallAlerts();

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
        growthAlerts={growthAlerts.alerts}
        priorityCalls={priorityCalls.alerts}
        search={search}
        setSearch={setSearch}
        submit={submit}
        {...identity}
      />
      <DesktopHeader
        alerts={humanHandoff.alerts}
        growthAlerts={growthAlerts.alerts}
        priorityCalls={priorityCalls.alerts}
        {...identity}
      />
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
  growthAlerts,
  priorityCalls,
}: ProfileProps & {
  alerts: HumanHandoffAlert[];
  growthAlerts: GrowthAlert[];
  priorityCalls: PriorityCallAlert[];
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
          <NotificationsBell
            alerts={alerts}
            growthAlerts={growthAlerts}
            priorityCalls={priorityCalls}
            mobile
          />

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
  growthAlerts,
  priorityCalls,
}: ProfileProps & {
  local: boolean;
  alerts: HumanHandoffAlert[];
  growthAlerts: GrowthAlert[];
  priorityCalls: PriorityCallAlert[];
}) {
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
          <NotificationsBell
            alerts={alerts}
            growthAlerts={growthAlerts}
            priorityCalls={priorityCalls}
          />

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
  alerts,growthAlerts,priorityCalls,mobile=false,
}: {alerts:HumanHandoffAlert[];growthAlerts:GrowthAlert[];priorityCalls:PriorityCallAlert[];mobile?:boolean}) {
  const {organizationId}=useAppState();
  const navigate=useNavigate();
  const [open,setOpen]=useState(false);
  const [readIds,setReadIds]=useState<string[]>([]);
  const storageKey=`esads-notifications-read:${organizationId}`;
  useEffect(()=>{
    const refresh=()=>{try{setReadIds(JSON.parse(localStorage.getItem(storageKey)??"[]") as string[])}catch{setReadIds([])}};
    refresh();window.addEventListener("storage",refresh);window.addEventListener("esads:notifications-read",refresh);
    return()=>{window.removeEventListener("storage",refresh);window.removeEventListener("esads:notifications-read",refresh)};
  },[storageKey]);
  const ordered=useMemo(()=>[...alerts].sort((a,b)=>b.waitingMinutes-a.waitingMinutes),[alerts]);
  const combined=useMemo(()=>[
    ...priorityCalls.map(a=>({...a,id:a.id,kind:"call" as const})),
    ...ordered.map(a=>({id:`handoff:${a.opportunityId}`,title:a.title,description:`Aguardando atendimento humano ${waitingLabel(a.waitingMinutes)}`,href:`/crm?opportunity=${encodeURIComponent(a.opportunityId)}`,kind:"handoff" as const})),
    ...growthAlerts.map(a=>({...a,kind:"growth" as const})),
  ],[priorityCalls,ordered,growthAlerts]);
  const pending=combined.filter(a=>!readIds.includes(a.id));
  const markRead=(ids:string[])=>{
    const next=[...new Set([...readIds,...ids])].slice(-500);
    localStorage.setItem(storageKey,JSON.stringify(next));
    setReadIds(next);
    window.dispatchEvent(new Event("esads:notifications-read"));
  };
  return <div className="relative">
    <Button variant="ghost" size="sm" aria-label="Notificações" aria-expanded={open} onClick={()=>setOpen(v=>!v)} className={pending.length?"relative":undefined}>
      <Bell size={mobile?21:20} className={pending.some(a=>a.kind==="call")?"text-destructive":pending.length?"text-amber-700":undefined}/>
      {pending.length>0&&<span className="absolute -right-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">{pending.length>9?"9+":pending.length}</span>}
    </Button>
    {open&&<div className={mobile?"fixed left-4 right-4 top-16 z-50 max-h-[70dvh] overflow-auto rounded-2xl border bg-card p-3 shadow-overlay":"absolute right-0 top-[calc(100%+.5rem)] z-50 max-h-[70dvh] w-[380px] max-w-[90vw] overflow-auto rounded-2xl border bg-card p-3 shadow-overlay"}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div><p className="font-semibold">Notificações</p><p className="text-xs text-muted-foreground">Avisos pendentes da equipe</p></div>
        {pending.length>0&&<button className="text-xs font-semibold text-primary hover:underline" onClick={()=>markRead(pending.map(a=>a.id))}>Marcar todas como lidas</button>}
      </div>
      {pending.length===0?<p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">Nenhuma notificação pendente.</p>:
      <div className="space-y-2">{pending.slice(0,30).map(alert=><button key={alert.id} type="button" onClick={()=>{markRead([alert.id]);setOpen(false);navigate(alert.href)}} className={`w-full rounded-xl border p-3 text-left transition hover:bg-muted/50 ${alert.kind==="call"?"border-amber-300 bg-amber-50":""}`}>
        <p className="text-sm font-semibold">{alert.title}</p><p className="mt-1 text-xs text-muted-foreground">{alert.description}</p>
        <p className="mt-1 text-xs font-semibold text-primary">Abrir e marcar como lida →</p>
      </button>)}</div>}
      <p className="mt-3 text-xs text-muted-foreground">Marcar como lida não conclui tarefas de ligação nem atendimentos.</p>
    </div>}
  </div>;
}
