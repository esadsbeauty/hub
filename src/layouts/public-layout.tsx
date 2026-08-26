import { Link, Outlet } from "react-router-dom";
import { BrandLogo } from "@/shared/components/brand/brand-logo";

export function PublicLayout() {
  return (
    <div className="min-h-dvh bg-[#fbfaf8] text-foreground">
      <header className="border-b border-black/5 bg-[#fbfaf8]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-6xl items-center px-5 md:px-8">
          <Link to="/blog" aria-label="ESADS Beauty">
            <BrandLogo compact className="w-24 sm:w-28" />
          </Link>

          <nav className="ml-auto flex items-center gap-3 sm:gap-5">
            <Link className="text-sm font-semibold" to="/blog">
              Blog
            </Link>

            <Link
              className="hidden text-sm font-semibold sm:block"
              to="/diagnostico"
            >
              Diagnóstico
            </Link>

            <a
              className="rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground sm:px-5"
              href="/login"
            >
              Entrar no Hub
            </a>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="mt-20 border-t border-black/5 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between md:px-8">
          <BrandLogo size="sm" />
          <p>Conteúdo para operações de estética mais fortes.</p>
          <a className="font-semibold text-foreground" href="/login">
            Acesso ao Hub
          </a>
        </div>
      </footer>
    </div>
  );
}
