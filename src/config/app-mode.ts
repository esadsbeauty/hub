export type AppMode = "local" | "supabase";

const requestedMode = import.meta.env.VITE_APP_MODE;
const runtimeEnvironment = import.meta.env.VITE_RUNTIME_ENV;
const localEnvironment = runtimeEnvironment === "development" || runtimeEnvironment === "preview";

export const appMode: AppMode = requestedMode === "local" && localEnvironment ? "local" : "supabase";
export const isLocalMode = appMode === "local";

if (import.meta.env.DEV && isLocalMode) {
  console.info("ESADS Hub local mode enabled.");
}
