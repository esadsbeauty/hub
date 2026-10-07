import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

describe("Stage 1A desktop topbar", () => {
  const topbar = readFileSync("src/shared/components/layout/topbar.tsx", "utf8");
  const switcher = readFileSync("src/shared/components/layout/tenant-switcher.tsx", "utf8");

  test("prioritizes a readable tenant switcher without desktop search overlap", () => {
    const desktop = topbar.slice(topbar.indexOf("function DesktopHeader"));
    expect(desktop).toContain('<div className="min-w-0 flex-1"><TenantSwitcher/></div>');
    expect(desktop).toContain("shrink-0 items-center");
    expect(desktop).not.toContain("Buscar empresa, contato ou telefone");
    expect(switcher).toContain("w-full max-w-[28rem]");
  });

  test("removes only the global desktop new shortcut and preserves mobile", () => {
    expect(topbar).not.toContain("canCreate");
    expect(topbar).not.toContain("/crm?new=company&quick=1");
    expect(topbar).toContain("function MobileHeader");
    expect(topbar).toContain("Buscar empresa ou contato");
  });
});
