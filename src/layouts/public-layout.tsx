import { Link, Outlet, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { BrandLogo } from "@/shared/components/brand/brand-logo";
import { captureSalesAttribution } from "@/modules/sales/tracking";

export function PublicLayout() {
  const location = useLocation();const[open,setOpen]=useState(false);useEffect(()=>{captureSalesAttribution();setOpen(false)},[location.pathname,location.search]);
  return (
    <div className="min-h-dvh bg-[#fbfaf8] text-foreground">
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#fbfaf8]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center px-5 sm:h-20 md:px-8">
          <Link to="/sistema" aria-label="ESADS Beauty">
            <BrandLogo compact className="w-24 sm:w-28" />
          </Link>
          <nav className="ml-auto hidden items-center gap-6 text-sm font-semibold sm:flex"><Link to="/sistema">Sistema</Link><Link to="/diagnostico">Diagnóstico</Link><Link to="/blog">Blog</Link><a href="/login">Entrar</a><Link className="rounded-full bg-primary px-5 py-3 text-primary-foreground" to="/sistema#planos">Conhecer o ESADS Beauty</Link></nav>
          <button aria-label="Abrir menu público" aria-expanded={open} onClick={()=>setOpen(value=>!value)} className="ml-auto grid h-11 w-11 place-items-center rounded-full border bg-white sm:hidden">{open?<X size={20}/>:<Menu size={20}/>}</button>
        </div>
        {open&&<nav className="grid gap-1 border-t bg-white px-5 py-4 text-base font-semibold sm:hidden"><Link className="min-h-11 rounded-xl px-3 py-2" to="/sistema">Sistema</Link><Link className="min-h-11 rounded-xl px-3 py-2" to="/diagnostico">Diagnóstico</Link><Link className="min-h-11 rounded-xl px-3 py-2" to="/blog">Blog</Link><a className="min-h-11 rounded-xl px-3 py-2" href="/login">Entrar</a><Link className="mt-2 inline-flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 text-white" to="/sistema#planos">Conhecer o ESADS Beauty</Link></nav>}
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <BrandLogo size="sm" />
          <p>ESADS Beauty · Organização comercial para negócios de beleza.</p><nav className="flex flex-wrap gap-5 font-semibold text-foreground"><Link to="/sistema">Sistema</Link><Link to="/diagnostico">Diagnóstico</Link><Link to="/blog">Blog</Link><a href="/login">Entrar</a></nav>
        </div>
      </footer>
    </div>
  );
}
