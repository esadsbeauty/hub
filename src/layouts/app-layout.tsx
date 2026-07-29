import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/shared/components/layout/sidebar';
import { Topbar } from '@/shared/components/layout/topbar';

export function AppLayout() {
  return <div className="min-h-screen bg-background"><Sidebar /><div className="lg:pl-72"><Topbar /><main className="min-h-[calc(100vh-8rem)] p-4 md:p-8"><Outlet /></main><footer className="border-t px-4 py-4 text-center text-xs text-muted-foreground md:px-8">ESADS Beauty Hub Interno · Fundação SaaS Enterprise</footer></div></div>;
}
