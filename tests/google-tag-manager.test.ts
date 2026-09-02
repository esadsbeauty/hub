import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("Google Tag Manager", () => {
  test("installs one global loader and one noscript fallback", () => {
    const html = readFileSync("index.html", "utf8");
    const container = "GTM-" + "KWRCN8RK";
    expect(html.match(new RegExp(container, "g"))?.length).toBe(2);
    expect(html.indexOf("googletagmanager.com/gtm.js")).toBeLessThan(html.indexOf("</head>"));
    expect(html).toMatch(/<body>\s*<!-- Google Tag Manager \(noscript\) -->\s*<noscript>/);
    expect(html.match(/googletagmanager\.com\/gtm\.js/g)?.length).toBe(1);
    expect(html.match(/googletagmanager\.com\/ns\.html/g)?.length).toBe(1);
  });

  test("tracks SPA navigation centrally in both routers", () => {
    const tracker = readFileSync("src/shared/analytics/spa-analytics.tsx", "utf8");
    const app = readFileSync("src/app/App.tsx", "utf8");
    const publicApp = readFileSync("src/app/public-app-root.tsx", "utf8");
    expect(tracker).toContain("useLocation");
    expect(tracker).toContain("lastTrackedPage");
    expect(tracker).toContain("page_title: document.title");
    expect(app).toContain("<SpaAnalytics />");
    expect(publicApp).toContain("<SpaAnalytics/>");
  });

  test("defines business events and rejects sensitive payload keys", () => {
    const helper = readFileSync("src/shared/analytics/data-layer.ts", "utf8");
    for (const event of ["lead_form_submit", "diagnostic_start", "diagnostic_complete", "whatsapp_click", "login_success", "opportunity_created", "opportunity_stage_changed", "proposal_value_updated"]) {
      expect(helper).toContain(event);
    }
    expect(helper).toContain("sensitiveKey");
    expect(helper).toMatch(/email.*phone.*telefone.*whatsapp.*cpf/i);
  });
});
