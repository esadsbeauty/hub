export const dataLayerEventNames = {
  virtualPageView: "virtual_page_view",
  leadFormSubmit: "lead_form_submit",
  diagnosticStart: "diagnostic_start",
  diagnosticComplete: "diagnostic_complete",
  whatsappClick: "whatsapp_click",
  loginSuccess: "login_success",
  opportunityCreated: "opportunity_created",
  opportunityStageChanged: "opportunity_stage_changed",
  proposalValueUpdated: "proposal_value_updated",
} as const;

type DataLayerValue = string | number | boolean;
type DataLayerPayload = Record<string, unknown>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, DataLayerValue>>;
  }
}

const sensitiveKey = /(?:name|nome|email|e-mail|phone|telefone|whatsapp|cpf|message|mensagem|content|conteudo)/i;

export function pushDataLayerEvent(event: string, payload: DataLayerPayload = {}) {
  if (typeof window === "undefined") return;
  const safePayload: Record<string, DataLayerValue> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (!sensitiveKey.test(key) && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) {
      safePayload[key] = value;
    }
  }
  window.dataLayer ??= [];
  window.dataLayer.push({ ...safePayload, event });
}
