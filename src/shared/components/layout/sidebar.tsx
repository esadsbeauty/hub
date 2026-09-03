import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Building2,
  Calendar,
  ChevronDown,
  ClipboardCheck,
  Handshake,
  LayoutDashboard,
  LogOut,
  Megaphone,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Settings,
  UserRoundSearch,
  Users,
  Wallet,
} from "lucide-react";

import type { Permission } from "@/shared/permissions/permissions";
import { useAppState } from "@/shared/state/app-state-context";
import { useAuth } from "@/providers/auth-context";
import { BrandLogo } from "@/shared/components/brand/brand-logo";
import { UserAvatar } from "@/shared/components/data-display/user-avatar";
import { useCurrentUserProfile } from "@/modules/profile/hooks";

export const navigationItems = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "dashboard.view",
  },
  {
    to: "/crm",
    label: "CRM",
    icon: Handshake,
    permission: "crm.view",
  },
  {
    to: "/agenda",
    label: "Agenda",
    icon: Calendar,
    permission: "agenda.view",
  },
  {
    to: "/clientes",
    label: "Clientes",
    icon: Users,
    permission: "customers.view",
  },
  {
    to: "/financeiro",
    label: "Financeiro",
    icon: Wallet,
    permission: "finance.view",
  },
  {
    to: "/relatorios",
    label: "Relatórios",
    icon: BarChart3,
    permission: "reports.view",
  },
  {
    to: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    permission: "settings.view",
  },
] satisfies {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  permission: Permission;
}[];

const roleNames = {
  owner: "Administrador principal",
  admin: "Administrador",
  manager: "Gestor",
  sales: "Comercial",
  operations: "Operacional",
  financial: "Financeiro",
  marketing: "Marketing",
  reader: "Leitura",
};

const linkClass = ({
  isActive,
}: {
  isActive: boolean;
}) =>
  `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
    isActive
      ? "bg-white/[.09] text-white before:absolute before:-left-1 before:h-5 before:w-0.5 before:rounded-full before:bg-champagne"
      : "text-white/55 hover:bg-white/[.055] hover:text-white/90"
  }`;

export function SidebarNavigation({
  onNavigate,
  collapsed = false,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
}) {
  const { can, isPlatformAdmin } = useAppState();
  const { pathname } = useLocation();

  const [marketingOpen, setMarketingOpen] = useState(
    pathname.startsWith("/marketing"),
  );

  const [platformOpen, setPlatformOpen] = useState(
    pathname.startsWith("/plataforma"),
  );

  const mainBeforeMarketing = navigationItems.slice(0, 5);
  const mainAfterMarketing = navigationItems.slice(5);

  const renderLink = ({
    to,
    label,
    icon: Icon,
    permission,
  }: (typeof navigationItems)[number]) =>
    can(permission) && (
      <NavLink
        end={to === "/"}
        onClick={onNavigate}
        key={to}
        to={to}
        title={collapsed ? label : undefined}
        aria-label={collapsed ? label : undefined}
        className={({ isActive }) =>
          `${linkClass({ isActive })} ${
            collapsed ? "justify-center px-0" : ""
          }`
        }
      >
        <Icon size={17} strokeWidth={1.7} />

        {!collapsed && <span>{label}</span>}
      </NavLink>
    );

  return (
    <nav className="space-y-1" aria-label="Navegação lateral">
      {mainBeforeMarketing.map(renderLink)}

      {can("marketing.view") && (
        <NavGroup
          label="Marketing"
          icon={Megaphone}
          open={marketingOpen}
          setOpen={setMarketingOpen}
          active={pathname.startsWith("/marketing")}
          collapsed={collapsed}
        >
          <NavLink
            onClick={onNavigate}
            to="/marketing"
            className={linkClass}
          >
            Visão Geral / Marketing
          </NavLink>

          <NavLink
            onClick={onNavigate}
            to="/marketing/diagnosticos"
            className={linkClass}
          >
            <ClipboardCheck size={16} />
            Diagnósticos
          </NavLink>

          {can("blog.view") && (
            <NavLink
              onClick={onNavigate}
              to="/marketing/blog"
              className={linkClass}
            >
              <BookOpen size={16} />
              Blog
            </NavLink>
          )}
        </NavGroup>
      )}

      {mainAfterMarketing.map(renderLink)}

      {isPlatformAdmin && (
        <NavGroup
          label="Plataforma"
          icon={ShieldCheck}
          open={platformOpen}
          setOpen={setPlatformOpen}
          active={pathname.startsWith("/plataforma")}
          collapsed={collapsed}
        >
          <NavLink
            end
            onClick={onNavigate}
            to="/plataforma"
            className={linkClass}
          >
            Visão geral
          </NavLink>

          <NavLink
            onClick={onNavigate}
            to="/plataforma/leads"
            className={linkClass}
          >
            <UserRoundSearch size={16} />
            Leads de Produto
          </NavLink>

          <NavLink
            onClick={onNavigate}
            to="/plataforma/organizacoes"
            className={linkClass}
          >
            <Building2 size={16} />
            Organizações
          </NavLink>
        </NavGroup>
      )}
    </nav>
  );
}

function NavGroup({
  label,
  icon: Icon,
  open,
  setOpen,
  active,
  collapsed,
  children,
}: {
  label: string;
  icon: typeof LayoutDashboard;
  open: boolean;
  setOpen: (value: boolean) => void;
  active: boolean;
  collapsed?: boolean;
  children: React.ReactNode;
}) {
  if (collapsed) {
    return (
      <div className="relative">
        <button
          type="button"
          aria-label={label}
          title={label}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
          className={`premium-focus flex w-full items-center justify-center rounded-xl px-0 py-2.5 ${
            active
              ? "bg-white/[.09] text-white"
              : "text-white/55 hover:bg-white/[.055] hover:text-white/90"
          }`}
        >
          <Icon size={17} />
        </button>

        {open && (
          <div className="absolute left-[calc(100%+.75rem)] top-0 z-50 w-56 rounded-xl border border-white/10 bg-sidebar p-2 shadow-overlay">
            <p className="px-3 py-2 text-xs font-semibold text-white/50">
              {label}
            </p>

            <div className="space-y-1">{children}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium ${
          active
            ? "text-white"
            : "text-white/55 hover:bg-white/[.055] hover:text-white/90"
        }`}
      >
        <Icon size={17} />

        <span className="flex-1 text-left">{label}</span>

        <ChevronDown
          size={15}
          className={`transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="ml-4 space-y-1 border-l border-white/10 pl-2">
          {children}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  collapsed,
  onCollapsedChange,
}: {
  collapsed: boolean;
  onCollapsedChange: (value: boolean) => void;
}) {
  const { user, signOut } = useAuth();
  const profile = useCurrentUserProfile().data;
  const { role } = useAppState();

  const toggleLabel = collapsed
    ? "Expandir menu lateral"
    : "Recolher menu lateral";

  return (
    <aside
      data-collapsed={collapsed}
      className={`fixed inset-y-0 left-0 z-30 hidden flex-col overflow-visible bg-sidebar text-white transition-[width] duration-200 lg:flex ${
        collapsed ? "w-20" : "w-64"
      }`}
    >
      <div
        className={`flex shrink-0 items-start ${
          collapsed
            ? "flex-col items-center gap-3 px-3 pb-5 pt-5"
            : "justify-between px-5 pb-5 pt-5"
        }`}
      >
        {collapsed ? (
          <span
            title="ESADS BEAUTY CRM"
            className="grid h-10 w-10 place-items-center overflow-hidden rounded-xl"
          >
            <BrandLogo compact className="w-10" />
          </span>
        ) : (
          <div>
            <BrandLogo className="w-36" />

            <p className="mt-2 text-xs font-semibold tracking-[.24em] text-white/50">
              CRM
            </p>
          </div>
        )}

        <button
          type="button"
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          title={toggleLabel}
          onClick={() => onCollapsedChange(!collapsed)}
          className="premium-focus grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white/55 hover:bg-white/10 hover:text-white"
        >
          {collapsed ? (
            <PanelLeftOpen size={19} />
          ) : (
            <PanelLeftClose size={19} />
          )}
        </button>
      </div>

      <div
        className={`min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4 [scrollbar-width:thin] ${
          collapsed
            ? "overflow-x-visible px-3"
            : "px-4"
        }`}
      >
        <SidebarNavigation collapsed={collapsed} />
      </div>

      <div
        className={`shrink-0 border-t border-white/10 bg-sidebar py-4 ${
          collapsed ? "px-3" : "px-6"
        }`}
      >
        <div
          className={`flex items-center ${
            collapsed
              ? "flex-col gap-2"
              : "gap-3"
          }`}
        >
          <NavLink
            to="/configuracoes"
            aria-label="Abrir perfil"
            title={collapsed ? "Perfil" : undefined}
            className="premium-focus shrink-0 rounded-full"
          >
            <UserAvatar
              size="sm"
              name={profile?.name}
              email={profile?.email ?? user?.email}
              src={profile?.avatarUrl}
            />
          </NavLink>

          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium">
                {profile?.name ??
                  user?.email ??
                  "Equipe ESADS"}
              </p>

              <p className="mt-0.5 text-[11px] text-white/40">
                {roleNames[role]}
              </p>
            </div>
          )}

          <button
            className="premium-focus rounded-lg p-2 text-white/40 hover:bg-white/10 hover:text-white"
            title={collapsed ? "Sair" : undefined}
            aria-label="Sair"
            onClick={() => void signOut()}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}