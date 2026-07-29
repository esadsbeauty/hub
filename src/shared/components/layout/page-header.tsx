import { ReactNode } from 'react';

export function PageHeader({ title, eyebrow, description, actions }: { title: string; eyebrow?: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[.28em] text-champagne-dark">{eyebrow}</p>}
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
        {description && <p className="mt-2 max-w-3xl text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
