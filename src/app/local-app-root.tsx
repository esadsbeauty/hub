import { App } from "./App";
import { AppQueryProvider } from "@/providers/query-provider";
import { LocalAuthProvider } from "@/providers/local-auth-provider";
import { LocalAppStateProvider } from "@/shared/state/local-app-state-provider";
import { ToastProvider } from "@/shared/components/feedback/toast";

export default function LocalAppRoot() {
  return <AppQueryProvider><LocalAuthProvider><LocalAppStateProvider><ToastProvider><App /></ToastProvider></LocalAppStateProvider></LocalAuthProvider></AppQueryProvider>;
}
