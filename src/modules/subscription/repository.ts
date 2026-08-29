import { isLocalMode } from "@/config/app-mode";
import { supabase } from "@/lib/supabase";
import type { SubscriptionAccess } from "./types";
const local: SubscriptionAccess = { status:"active",persistedStatus:"active",isBlocked:false,isPlatformAdmin:true,planName:"Legacy",priceCents:0,daysOverdue:0 };
export const subscriptionRepository={async access():Promise<SubscriptionAccess>{if(isLocalMode)return local;if(!supabase)throw new Error("Não foi possível validar a assinatura.");const result=await supabase.rpc("current_subscription_access");if(result.error)throw new Error("Não foi possível validar a assinatura desta organização.");return result.data as unknown as SubscriptionAccess;}};
