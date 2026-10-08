import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

import { useOrganizationFeature } from "@/shared/features/use-organization-feature";

export function FeatureRoute({
  featureKey,
  children,
}: {
  featureKey: string;
  children: ReactNode;
}) {
  const feature = useOrganizationFeature(featureKey);

  if (feature.isLoading) {
    return (
      <div className="grid min-h-[50vh] place-items-center text-sm text-muted-foreground">
        Validando acesso ao módulo...
      </div>
    );
  }

  if (feature.data !== true) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}