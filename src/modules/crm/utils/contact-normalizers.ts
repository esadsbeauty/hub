export function normalizeWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return `+${digits.length === 10 || digits.length === 11 ? `55${digits}` : digits}`;
}
export function normalizeInstagram(value: string) {
  const handle = value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
  return handle ? `@${handle}` : "";
}
