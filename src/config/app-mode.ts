export type AppMode = "local" | "supabase";

export const appMode: AppMode = import.meta.env.VITE_APP_MODE === "local" ? "local" : "supabase";
export const isLocalMode = appMode === "local";
