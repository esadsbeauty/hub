export function FilterBar({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-3 rounded-2xl border bg-card p-3 md:flex-row md:items-center">{children}</div>;
}
