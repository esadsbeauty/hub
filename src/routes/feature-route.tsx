import { Navigate } from "react-router-dom";
import { useOrganizationFeature } from "@/shared/features/use-organization-feature";

export function FeatureRoute({ featureKey, children }: { featureKey: string; children: React.ReactNode }) {
  const feature = useOrganizationFeature(featureKey);

  if (feature.isLoading) {
    return <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">Validando acesso ao módulo...</div>;
  }

  return feature.data === true ? <>{children}</> : <Navigate to="/" replace />;
}
