const PIXELS = ["1173812330296523", "162157623233063"] as const;
declare global { interface Window { fbq?: (...args: unknown[]) => void; _fbq?: (...args: unknown[]) => void } }
let initialized = false;
export function initializeDiagnosticPixels() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  if (!window.fbq) {
    type PixelStub = ((...args: unknown[]) => void) & { queue?: unknown[][]; callMethod?: (...args: unknown[]) => void; loaded?: boolean; version?: string };
    const fbq: PixelStub = (...args: unknown[]) => {
      if (fbq.callMethod) fbq.callMethod(...args);
      else (fbq.queue ??= []).push(args);
    };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = "2.0";
    window.fbq = fbq;
    window._fbq = fbq;
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    document.head.appendChild(script);
  }
  for (const id of PIXELS) window.fbq?.("init", id);
}
export function trackDiagnosticPixel(event: "PageView" | "ViewContent" | "Lead" | "Contact", parameters: Record<string, string | number> = {}, eventId?: string) {
  initializeDiagnosticPixels();
  window.fbq?.("track", event, parameters, eventId ? { eventID: eventId } : {});
}
export function trackDiagnosticPixelCustom(event: string, parameters: Record<string, string | number> = {}) {
  initializeDiagnosticPixels();
  window.fbq?.("trackCustom", event, parameters);
}
export function sendDiagnosticServerEvent(eventName: "Lead" | "Contact", eventId: string, resultToken: string) {
  void fetch("/api/diagnostic-meta-event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ eventName, eventId, resultToken }),
    keepalive: true,
  }).catch(() => undefined);
}
