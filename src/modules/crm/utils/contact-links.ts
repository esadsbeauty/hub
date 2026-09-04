export function normalizeContactPhone(value?: string) {
  const digits = value?.replace(/\D/g, "") ?? "";
  if (digits.length < 10 || digits.length > 15) return undefined;
  return digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
}

export function contactWhatsappUrl(value?: string) {
  const phone = normalizeContactPhone(value);
  return phone ? `https://wa.me/${phone}` : undefined;
}

export function contactTelephoneUrl(value?: string) {
  const phone = normalizeContactPhone(value);
  return phone ? `tel:+${phone}` : undefined;
}

export function normalizeInstagramUsername(value?: string) {
  if (!value) return undefined;
  const withoutUrl = value.trim().replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "");
  const username = withoutUrl.replace(/^@/, "").split(/[/?#]/)[0]?.trim();
  return username && /^[a-zA-Z0-9._]{1,30}$/.test(username) ? username : undefined;
}

export function contactInstagramUrl(value?: string) {
  const username = normalizeInstagramUsername(value);
  return username ? `https://instagram.com/${username}` : undefined;
}
