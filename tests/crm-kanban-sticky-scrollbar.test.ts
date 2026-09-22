import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const crm = readFileSync("src/modules/crm/CrmPage.tsx", "utf8");

describe("CRM Kanban sticky horizontal scrollbar", () => {
  test("keeps one synchronized desktop control while preserving mobile overflow", () => {
    expect(crm).toContain('aria-label="Rolagem horizontal do Kanban"');
    expect(crm).toContain('className="sticky bottom-0');
    expect(crm).toContain(
      "syncHorizontalScroll(event.currentTarget, stickyScrollRef.current)",
    );
    expect(crm).toContain(
      "syncHorizontalScroll(event.currentTarget, kanbanScrollRef.current)",
    );
    expect(crm).toContain("md:[scrollbar-width:none]");
    expect(crm).toContain("md:[&::-webkit-scrollbar]:hidden");
  });
});
