import { isLocalMode } from "@/config/app-mode";
import { supabase } from "@/lib/supabase";
import type { PlatformSnapshot } from "./types";

const modules = ["dashboard", "crm", "agenda", "customers", "finance", "marketing", "reports", "settings", "users", "roles", "audit", "blog"];
const local: PlatformSnapshot = { plans: [{ id: "founders", name: "Fundadores", slug: "fundadores", priceCents: 4990, billingMode: "manual", isActive: true, entitlements: modules }], organizations: [{ id: "local-esads-beauty", name: "ESADS Beauty", planId: "founders", planName: "Fundadores", status: "active" }] };

export const platformRepository = {
  async snapshot(): Promise<PlatformSnapshot> {
    if (isLocalMode) return local;
    if (!supabase) throw new Error("Não foi possível conectar à plataforma.");
    const result = await supabase.rpc("platform_admin_snapshot");
    if (result.error) throw new Error("Não foi possível carregar os planos da plataforma.");
    return result.data as unknown as PlatformSnapshot;
  },
  async assignPlan(organizationId: string, planId: string) {
    if (isLocalMode) return;
    if (!supabase) throw new Error("Não foi possível conectar à plataforma.");
    const result = await supabase.rpc("platform_assign_organization_plan", { target_organization_id: organizationId, target_plan_id: planId });
    if (result.error) throw new Error("Não foi possível alterar o plano da organização.");
  },
};
