export const publicEventNames={blogCtaClick:"blog_cta_click",diagnosticStart:"diagnostic_start",diagnosticComplete:"diagnostic_complete",diagnosticSystemCtaClick:"diagnostic_system_cta_click",salesPageView:"sales_page_view",salesLeadSubmit:"sales_lead_submit"}as const;
export type PublicEventName=typeof publicEventNames[keyof typeof publicEventNames];
export function trackPublicEvent(name:PublicEventName,detail:Record<string,unknown>={}){window.dispatchEvent(new CustomEvent("esads:analytics",{detail:{name,...detail}}))}
