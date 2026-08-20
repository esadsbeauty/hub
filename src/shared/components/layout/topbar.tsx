import { Bell, Plus, Search, UserCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAppState } from "@/shared/state/app-state-context";
import { useAuth } from "@/providers/auth-context";

export function Topbar() {
  const { can }=useAppState();const auth=useAuth();const navigate=useNavigate();const[search,setSearch]=useState("");
  const submit=(event:FormEvent)=>{event.preventDefault();const query=search.trim();navigate(query?`/crm?q=${encodeURIComponent(query)}`:"/crm")};
  return <><MobileHeader search={search} setSearch={setSearch} submit={submit} email={auth.user?.email} local={auth.appMode==="local"} signOut={auth.signOut}/><DesktopHeader canCreate={can("crm.manage")} email={auth.user?.email} local={auth.appMode==="local"} signOut={auth.signOut}/></>;
}

function MobileHeader({search,setSearch,submit,email,local,signOut}:{search:string;setSearch:(value:string)=>void;submit:(event:FormEvent)=>void;email?:string;local:boolean;signOut:()=>Promise<void>}) {
 return <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 px-[1.125rem] pb-5 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl min-[430px]:px-5 md:hidden"><div className="flex min-h-12 items-center"><div className="text-[1.35rem] font-bold tracking-[.2em]">ESADS</div>{local&&<span className="ml-3 rounded-full bg-champagne-soft px-2.5 py-1 text-sm font-semibold">Local</span>}<div className="ml-auto flex items-center gap-2"><Button variant="ghost" size="sm" aria-label="Notificações"><Bell size={24}/></Button><Profile email={email} signOut={signOut}/></div></div><form onSubmit={submit} className="mt-4"><label className="relative block"><span className="sr-only">Buscar no CRM</span><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={21}/><Input value={search} onChange={event=>setSearch(event.target.value)} enterKeyHint="search" className="border-transparent bg-card pl-12 text-[17px] shadow-soft" placeholder="Buscar empresa ou contato…"/></label></form></header>;
}

function DesktopHeader({canCreate,email,local,signOut}:{canCreate:boolean;email?:string;local:boolean;signOut:()=>Promise<void>}) {
 return <header className="sticky top-0 z-20 hidden border-b border-border/60 bg-background/95 px-6 py-3 backdrop-blur-xl md:block lg:px-8"><div className="mx-auto flex max-w-[90rem] items-center gap-3">{local&&<span className="rounded-full bg-champagne-soft px-2.5 py-1 text-[11px] font-semibold">Modo local</span>}<label className="relative max-w-md flex-1"><span className="sr-only">Buscar no CRM</span><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={17}/><Input className="border-transparent bg-muted/70 pl-10 shadow-none focus-visible:bg-card" placeholder="Buscar empresa, contato ou telefone…"/></label><div className="ml-auto flex items-center gap-2">{canCreate&&<Link className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground" to="/crm?new=company&quick=1"><Plus size={17}/>Novo</Link>}<Button variant="ghost" size="sm" aria-label="Notificações"><Bell size={20}/></Button><Profile email={email} signOut={signOut}/></div></div></header>;
}

function Profile({email,signOut}:{email?:string;signOut:()=>Promise<void>}) { return <details className="relative"><summary className="grid h-12 w-12 cursor-pointer list-none place-items-center rounded-full bg-card shadow-soft md:h-11 md:w-11"><UserCircle size={26}/></summary><div className="absolute right-0 mt-2 w-64 rounded-2xl bg-card p-3 shadow-overlay"><p className="truncate text-sm font-medium">{email??"Equipe ESADS"}</p><Link className="mt-3 block rounded-xl px-3 py-3 text-sm hover:bg-muted" to="/configuracoes">Meu perfil</Link><button className="min-h-12 w-full rounded-xl px-3 text-left text-sm text-danger hover:bg-muted" onClick={()=>void signOut()}>Sair</button></div></details>; }
