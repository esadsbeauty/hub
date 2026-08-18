import { createClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured } from "@/config/env";
import type { Database } from "@/shared/types/database";

export const supabase = isSupabaseConfigured
  ? createClient<Database>(env.supabaseUrl!, env.supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
