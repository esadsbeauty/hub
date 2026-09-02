import { dataLayerEventNames, pushDataLayerEvent } from "./data-layer";
export const publicEventNames={blogCtaClick:"blog_cta_click",diagnosticStart:dataLayerEventNames.diagnosticStart,diagnosticComplete:dataLayerEventNames.diagnosticComplete,diagnosticSystemCtaClick:"diagnostic_system_cta_click",salesPageView:"sales_page_view",salesLeadSubmit:dataLayerEventNames.leadFormSubmit}as const;
export type PublicEventName=typeof publicEventNames[keyof typeof publicEventNames];
export function trackPublicEvent(name:PublicEventName,detail:Record<string,unknown>={}){pushDataLayerEvent(name,detail);window.dispatchEvent(new CustomEvent("esads:analytics",{detail:{name,...detail}}))}
