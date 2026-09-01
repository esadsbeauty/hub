import { Outlet } from "react-router-dom";
import { Sidebar } from "@/shared/components/layout/sidebar";
import { Topbar } from "@/shared/components/layout/topbar";
import { SubscriptionPastDueBanner } from "@/modules/subscription/SubscriptionPastDueBanner";
import { MobileNavigation } from "@/shared/components/layout/mobile-navigation";
import { TenantContextBanner } from "@/shared/components/layout/tenant-context-banner";
export function AppLayout(){return <div className="min-h-dvh bg-background"><Sidebar/><div className="lg:pl-64"><Topbar/><TenantContextBanner/><SubscriptionPastDueBanner/><main className="min-h-[calc(100dvh-4rem)] px-4 py-6 pb-32 min-[430px]:px-5 md:px-6 md:py-8 lg:px-8 lg:pb-8"><Outlet/></main><MobileNavigation/></div></div>}
