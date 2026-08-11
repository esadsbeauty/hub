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

export function localDateTimeToUtc(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

export function localDateKey(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function relativeDueLabel(value: string) {
  const due = new Date(value);
  const today = new Date();
  const todayStart = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  const dueStart = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const days = Math.round(
    (dueStart.getTime() - todayStart.getTime()) / 86400000,
  );
  if (days < -1) return `Atrasado há ${Math.abs(days)} dias`;
  if (days === -1) return "Atrasado desde ontem";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return `Em ${days} dias`;
}
