import { App } from "./App";
import { AppQueryProvider } from "@/providers/query-provider";
import { SupabaseAuthProvider } from "@/providers/auth-provider";
import { SupabaseAppStateProvider } from "@/shared/state/app-state";
import { ToastProvider } from "@/shared/components/feedback/toast";

export default function SupabaseAppRoot() {
  return <AppQueryProvider><SupabaseAuthProvider><SupabaseAppStateProvider><ToastProvider><App /></ToastProvider></SupabaseAppStateProvider></SupabaseAuthProvider></AppQueryProvider>;
}
