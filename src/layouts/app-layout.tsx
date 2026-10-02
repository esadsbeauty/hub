import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import { Sidebar } from "@/shared/components/layout/sidebar";
import { Topbar } from "@/shared/components/layout/topbar";
import { MobileNavigation } from "@/shared/components/layout/mobile-navigation";
import { TenantContextBanner } from "@/shared/components/layout/tenant-context-banner";
import { SubscriptionPastDueBanner } from "@/modules/subscription/SubscriptionPastDueBanner";

const SIDEBAR_STORAGE_KEY = "esads-sidebar-collapsed";

export function AppLayout() {
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
        <Topbar />

        <TenantContextBanner />
        <SubscriptionPastDueBanner />

        <main className="min-h-[calc(100dvh-4rem)] px-4 py-6 pb-32 min-[430px]:px-5 md:px-6 md:py-8 lg:px-8 lg:pb-8">
          <Outlet />
        </main>

        <MobileNavigation />
      </div>
    </div>
  );
}