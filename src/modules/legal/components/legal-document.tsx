import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { SeoHead } from "@/modules/blog/components/seo-head";

export type LegalSection = {
  title: string;
  content: ReactNode;
};

type LegalDocumentProps = {
  title: string;
  description: string;
  path: string;
  eyebrow: string;
  sections: LegalSection[];
  relatedLink: { to: string; label: string };
};

export function LegalDocument({
  title,
  description,
  path,
  eyebrow,
  sections,
  relatedLink,
}: LegalDocumentProps) {
  return (
    <>
      <SeoHead
        title={`${title} | ESADS Beauty`}
        description={description}
        path={path}
      />
      <article className="overflow-hidden">
        <header className="border-b border-black/5 bg-[radial-gradient(circle_at_top_left,rgba(198,167,105,.16),transparent_42%)]">
          <div className="mx-auto max-w-4xl px-5 py-14 sm:py-20 md:px-8 md:py-24">
            <Link
              to="/sistema"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-black/10 bg-white/80 px-4 text-sm font-semibold shadow-sm transition-colors hover:bg-white premium-focus"
            >
              <ArrowLeft size={16} /> Voltar para o início
            </Link>
            <p className="mt-10 text-xs font-bold uppercase tracking-[.2em] text-champagne-dark sm:text-sm">
              {eyebrow}
            </p>
            <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-.05em] sm:text-5xl md:text-6xl">
              {title}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
              {description}
            </p>
            <p className="mt-6 text-sm font-medium text-muted-foreground">
              Última atualização: setembro de 2026
            </p>
          </div>
        </header>

        <div className="mx-auto grid max-w-5xl gap-12 px-5 py-14 md:grid-cols-[13rem_minmax(0,1fr)] md:px-8 md:py-20">
          <aside className="hidden md:block">
            <nav aria-label={`Índice de ${title}`} className="sticky top-28">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-muted-foreground">
                Nesta página
              </p>
              <ol className="mt-4 space-y-2 border-l border-border pl-4 text-sm text-muted-foreground">
                {sections.map((section, index) => (
                  <li key={section.title}>
                    <a className="transition-colors hover:text-foreground" href={`#secao-${index + 1}`}>
                      {section.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          </aside>

          <div className="min-w-0 space-y-12 sm:space-y-14">
            {sections.map((section, index) => (
              <section id={`secao-${index + 1}`} key={section.title} className="scroll-mt-28">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-champagne-dark">
                  {String(index + 1).padStart(2, "0")}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-.03em] sm:text-3xl">
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 text-base leading-7 text-muted-foreground [&_a]:font-semibold [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-2">
                  {section.content}
                </div>
              </section>
            ))}

            <div className="rounded-2xl border border-champagne/40 bg-champagne-soft/45 p-6 sm:p-8">
              <p className="text-sm font-bold uppercase tracking-[.14em] text-champagne-dark">
                Documento relacionado
              </p>
              <Link className="mt-3 inline-block text-lg font-semibold underline underline-offset-4" to={relatedLink.to}>
                {relatedLink.label}
              </Link>
            </div>
          </div>
        </div>
      </article>
    </>
  );
}
