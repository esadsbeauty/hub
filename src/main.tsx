import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { appMode, isLocalMode } from "@/config/app-mode";
import "./styles/globals.css";

console.info("[ESADS APP MODE]", { appMode, isLocalMode });

const ApplicationRoot = lazy(() => isLocalMode ? import("./app/local-app-root") : import("./app/supabase-app-root"));

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Suspense fallback={<div className="grid min-h-dvh place-items-center text-sm text-muted-foreground">Carregando Hub…</div>}>
      <ApplicationRoot />
    </Suspense>
  </React.StrictMode>,
);
