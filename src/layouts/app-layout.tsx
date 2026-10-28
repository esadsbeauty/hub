import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import { Sidebar } from "@/shared/components/layout/sidebar";
import { Topbar } from "@/shared/components/layout/topbar";
import { MobileNavigation } from "@/shared/components/layout/mobile-navigation";
import { TenantContextBanner } from "@/shared/components/layout/tenant-context-banner";
import { SubscriptionPastDueBanner } from "@/modules/subscription/SubscriptionPastDueBanner";

const SIDEBAR_STORAGE_KEY = "esads-sidebar-collapsed";

export function AppLayout() {
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  // Dismiss native dropdown menus when tapping outside (including on mobile).
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      document.querySelectorAll<HTMLDetailsElement>('details[data-dismiss-on-outside][open]')
        .forEach(menu => { if (!menu.contains(target)) menu.open = false; });
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      document.querySelectorAll<HTMLDetailsElement>('details[data-dismiss-on-outside][open]')
        .forEach(menu => { menu.open = false; });
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  useEffect(() => {
    const update = (event: Event) => setMobileChatOpen(Boolean((event as CustomEvent<{open:boolean}>).detail?.open));
    window.addEventListener("esads:whatsapp-chat-visibility", update);
    return () => window.removeEventListener("esads:whatsapp-chat-visibility", update);
  }, []);
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;

    return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
  });

  useEffect(() => {
    localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      String(collapsed),
    );
  }, [collapsed]);

  return (
    <div className="min-h-dvh bg-background">
      <Sidebar
        collapsed={collapsed}
        onCollapsedChange={setCollapsed}
      />

      <div
        className={`transition-[padding] duration-200 ${
          collapsed ? "lg:pl-20" : "lg:pl-64"
        }`}
      >
        <div className={mobileChatOpen ? "max-md:hidden" : ""}><Topbar /></div>

        <div className={mobileChatOpen ? "max-md:hidden" : ""}><TenantContextBanner /></div>
        <div className={mobileChatOpen ? "max-md:hidden" : ""}><SubscriptionPastDueBanner /></div>

        <main className={`min-h-[calc(100dvh-4rem)] px-4 py-6 pb-32 min-[430px]:px-5 md:px-6 md:py-8 lg:px-8 lg:pb-8 ${mobileChatOpen ? "max-md:!h-[100dvh] max-md:!min-h-0 max-md:!overflow-hidden max-md:!p-0" : ""}`}>
          <Outlet />
        </main>

        {!mobileChatOpen && <MobileNavigation />}
      </div>
    </div>
  );
}