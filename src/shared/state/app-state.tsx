import { createContext, useContext, useMemo, useState } from 'react';
import { type Permission, rolePermissions, type Role } from '@/shared/permissions/permissions';

type Organization = { id: string; name: string };
type Preferences = { sidebarCollapsed: boolean; density: 'comfortable' | 'compact' };

type AppState = {
  organization: Organization;
  role: Role;
  permissions: Permission[];
  theme: 'light' | 'dark';
  preferences: Preferences;
  setTheme: (theme: 'light' | 'dark') => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
};

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [preferences, setPreferences] = useState<Preferences>({ sidebarCollapsed: false, density: 'comfortable' });
  const role: Role = 'admin';

  const value = useMemo<AppState>(() => ({
    organization: { id: 'esads-beauty', name: 'ESADS Beauty' },
    role,
    permissions: rolePermissions[role],
    theme,
    preferences,
    setTheme,
    setSidebarCollapsed: (sidebarCollapsed) => setPreferences((current) => ({ ...current, sidebarCollapsed })),
  }), [theme, preferences]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppStateProvider');
  return value;
}
