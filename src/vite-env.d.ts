/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_MODE?: "local" | "supabase";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
