import { Navigate, Outlet } from "react-router-dom";
import { useAppState } from "@/shared/state/app-state-context";
import { useSubscriptionAccess } from "@/modules/subscription/hooks";

export function TenantSubscriptionRoute(){
 const{authorizationLoading,isPlatformAdmin,status}=useAppState();
 const access=useSubscriptionAccess(!authorizationLoading&&status==="active"&&!isPlatformAdmin);
 if(authorizationLoading||access.isLoading)return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Validando assinatura...</div>;
 if(isPlatformAdmin)return <Outlet/>;
 if(status!=="active")return <Outlet/>;
 if(access.isError)return <div className="grid min-h-[55vh] place-items-center text-center"><div><h1 className="text-xl font-semibold">Não foi possível validar sua assinatura</h1><button className="mt-4 text-sm font-semibold underline" onClick={()=>void access.refetch()}>Tentar novamente</button></div></div>;
 if(access.data?.isBlocked)return <Navigate to="/assinatura-suspensa" replace/>;
 return <Outlet/>;
}
