/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: "local" | "supabase";
  readonly VITE_RUNTIME_ENV: "development" | "preview" | "production" | "unknown";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
