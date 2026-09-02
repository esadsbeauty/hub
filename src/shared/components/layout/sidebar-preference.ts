import { useState } from "react";

export const SIDEBAR_PREFERENCE_KEY = "esads:sidebar-collapsed";

export function initialSidebarCollapsed(pathname: string, storage: Pick<Storage, "getItem"> | undefined = typeof window === "undefined" ? undefined : window.localStorage) {
  const saved = storage?.getItem(SIDEBAR_PREFERENCE_KEY);
  if (saved === "true" || saved === "false") return saved === "true";
  return pathname !== "/";
}

export function useSidebarPreference(pathname: string) {
  const [collapsed, setCollapsedState] = useState(() => initialSidebarCollapsed(pathname));
  const setCollapsed = (value: boolean) => {
    window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(value));
    setCollapsedState(value);
  };
  return [collapsed, setCollapsed] as const;
}
