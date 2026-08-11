export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
export function formatDateTime(value?: string) {
  return value
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
}
export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
export function daysSince(value: string) {
  return Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 86400000),
  );
}
export function taskTypeLabel(value: string) {
  const labels: Record<string, string> = {
    follow_up: "Follow-up",
    call: "Ligação",
    whatsapp: "WhatsApp",
    email: "Email",
    meeting: "Reunião",
    task: "Tarefa",
  };
  return labels[value] ?? "Atividade";
}
