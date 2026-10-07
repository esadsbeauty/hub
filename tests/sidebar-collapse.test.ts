import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { initialSidebarCollapsed, SIDEBAR_PREFERENCE_KEY } from "../src/shared/components/layout/sidebar-preference";

const sidebar = readFileSync("src/shared/components/layout/sidebar.tsx", "utf8");
const layout = readFileSync("src/layouts/app-layout.tsx", "utf8");
const mobile = readFileSync("src/shared/components/layout/mobile-navigation.tsx", "utf8");

describe("collapsible desktop sidebar", () => {
  test("defaults Dashboard expanded and operational modules collapsed", () => {
    const emptyStorage = { getItem: () => null };
    expect(initialSidebarCollapsed("/", emptyStorage)).toBeFalse();
    expect(initialSidebarCollapsed("/crm", emptyStorage)).toBeTrue();
    expect(initialSidebarCollapsed("/agenda", emptyStorage)).toBeTrue();
  });

  test("restores the explicit local preference across routes and tenants", () => {
    expect(initialSidebarCollapsed("/", { getItem: key => key === SIDEBAR_PREFERENCE_KEY ? "true" : null })).toBeTrue();
    expect(initialSidebarCollapsed("/crm", { getItem: () => "false" })).toBeFalse();
    expect(layout).toContain("useSidebarPreference(pathname)");
  });

  test("uses responsive widths and moves content without empty space", () => {
    expect(sidebar).toContain('collapsed ? "w-20" : "w-64"');
    expect(layout).toContain('sidebarCollapsed ? "lg:pl-20" : "lg:pl-64"');
    expect(sidebar).toContain("transition-[width] duration-200");
    expect(layout).toContain("transition-[padding] duration-200");
  });

  test("keeps icon navigation, active indicators and accessible tooltips", () => {
    expect(sidebar).toContain('role="tooltip"');
    expect(sidebar).toContain("group-focus-visible:block");
    expect(sidebar).toContain("before:bg-champagne");
    expect(sidebar).toContain("aria-label={collapsed ? label : undefined}");
    expect(sidebar).toContain("aria-expanded={!collapsed}");
  });

  test("keeps Marketing and Platform available through collapsed flyouts", () => {
    expect(sidebar).toContain('label="Marketing"');
    expect(sidebar).toContain('label="Plataforma"');
    expect(sidebar).toContain("fixed left-20");
    expect(sidebar).toContain("getBoundingClientRect().top");
    expect(sidebar).toContain("isPlatformAdmin");
  });

  test("preserves profile, logout and mobile navigation", () => {
    expect(sidebar).toContain('aria-label="Abrir perfil"');
    expect(sidebar).toContain('aria-label="Sair"');
    expect(sidebar).toContain("lg:flex");
    expect(layout).toContain("<MobileNavigation/>");
    expect(mobile).not.toContain("SIDEBAR_PREFERENCE_KEY");
  });
});
