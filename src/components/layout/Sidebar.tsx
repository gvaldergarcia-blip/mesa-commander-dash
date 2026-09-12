import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";

import { useModules } from "@/contexts/ModulesContext";
import {
  LayoutDashboard,
  Users,
  Calendar,
  UserCheck,
  Megaphone,
  BarChart3,
  Settings,
  Menu,
  X,
  Moon,
  Sun,
  LogOut,
  Film,
  ClipboardList,
  Tag,
  Sparkles,
  LucideIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURE_FLAGS } from "@/config/feature-flags";
import { MODULES, ModuleIcon } from "@/config/modules";
import { useTheme } from "@/hooks/useTheme";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";

const ICON_MAP: Record<ModuleIcon, LucideIcon> = {
  LayoutDashboard,
  Users,
  Calendar,
  UserCheck,
  Megaphone,
  BarChart3,
  ClipboardList,
  Tag,
  Film,
  Sparkles,
};

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { hasModule } = useModules();
  const { restaurant, userRole } = useRestaurant();
  const isAdmin = userRole === 'admin';
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Close mobile drawer whenever the route changes
  useEffect(() => {
    if (isMobile) setMobileOpen(false);
  }, [location.pathname, isMobile]);

  // Listen for global "open sidebar" events from the header hamburger
  useEffect(() => {
    if (!isMobile) return;
    const open = () => setMobileOpen(true);
    window.addEventListener('mesaclik:open-sidebar', open);
    return () => window.removeEventListener('mesaclik:open-sidebar', open);
  }, [isMobile]);

  // Gera itens de navegação a partir do registro central de módulos
  const navigation = MODULES.filter((item) => {
    if (item.featureFlag && !FEATURE_FLAGS[item.featureFlag]) return false;
    if (!hasModule(item.key)) return false;
    if (item.adminOnly && !isAdmin) return false;
    return true;
  }).map((item) => ({
    name: item.name,
    href: item.href,
    icon: ICON_MAP[item.icon],
  }));

  // Obter inicial do nome do restaurante para fallback
  const restaurantInitial = restaurant?.name?.charAt(0)?.toUpperCase() || 'R';

  const sidebarContent = (forceExpanded = false) => {
    const showLabels = forceExpanded || !isCollapsed;
    return (
      <>
      {/* Top Section: Header + Navigation */}
      <div>
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-4 border-b border-sidebar-border/50">
          <div className={cn(
            "flex items-center gap-3 transition-all duration-200",
            !showLabels && "opacity-0 w-0 overflow-hidden"
          )}>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-none">
                <span className="text-sidebar-foreground">MESA</span>
                <span className="text-primary">CLIK</span>
              </h1>
              <p className="text-[10px] text-sidebar-foreground/40 uppercase tracking-[0.15em] mt-0.5">Painel</p>
            </div>
          </div>
          {forceExpanded ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
            >
              {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </Button>
          )}
        </div>

        {/* Navigation */}
        <nav className="px-3 py-4">
          <div className="space-y-1">
            {navigation.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                end={item.href === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/40"
                  )
                }
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className={cn(
                  "ml-3 transition-all duration-200",
                  !showLabels && "opacity-0 w-0 overflow-hidden ml-0"
                )}>
                  {item.name}
                </span>

                {/* Tooltip for collapsed state */}
                {!showLabels && (
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-popover text-popover-foreground text-xs font-medium rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 whitespace-nowrap z-50 shadow-lg border">
                    {item.name}
                  </div>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>

      {/* Footer Section */}
      <div className="border-t border-sidebar-border/50 p-3 space-y-3 bg-sidebar-accent/20">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
            "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50",
            !showLabels && "justify-center px-0"
          )}
        >
          {theme === "dark" ? (
            <Moon className="h-4 w-4 shrink-0" />
          ) : (
            <Sun className="h-4 w-4 shrink-0" />
          )}
          <span className={cn(
            "transition-all duration-200",
            !showLabels && "opacity-0 w-0 overflow-hidden"
          )}>
            {theme === "dark" ? "Modo Escuro" : "Modo Claro"}
          </span>
        </button>

        {/* Logout Button */}
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            localStorage.clear();
            sessionStorage.clear();
            if (window.top) {
              window.top.location.href = '/';
            } else {
              window.location.href = '/';
            }
          }}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150",
            "text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10",
            !showLabels && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className={cn(
            "transition-all duration-200",
            !showLabels && "opacity-0 w-0 overflow-hidden"
          )}>
            Sair
          </span>
        </button>

        {/* Restaurant Info - Exibe nome e logo oficiais das Configurações */}
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/30",
          !showLabels && "justify-center px-2"
        )}>
          {/* Avatar com logo ou inicial */}
          <div className="w-8 h-8 bg-primary/10 border border-primary/20 rounded-full flex items-center justify-center flex-shrink-0 overflow-hidden">
            {restaurant?.image_url ? (
              <img
                src={restaurant.image_url}
                alt={restaurant.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
            ) : null}
            <span className={cn(
              "text-xs font-semibold text-primary",
              restaurant?.image_url && "hidden"
            )}>
              {restaurantInitial}
            </span>
          </div>
          <div className={cn(
            "min-w-0 transition-all duration-200",
            !showLabels && "opacity-0 w-0 overflow-hidden"
          )}>
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {restaurant?.name || 'Carregando...'}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
              {isAdmin ? 'Administrador' : 'Operador'}
            </p>
          </div>
        </div>
      </div>
      </>
    );
  };

  // Mobile: drawer (offcanvas) — sidebar is hidden by default and opens via hamburger
  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[85vw] max-w-xs p-0 bg-sidebar text-sidebar-foreground border-sidebar-border [&>button]:hidden overflow-y-auto"
        >
          <div className="flex flex-col justify-between h-full">
            {sidebarContent(true)}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop & tablet (≥768px): unchanged sticky sidebar
  return (
    <aside className={cn(
      "bg-sidebar text-sidebar-foreground flex flex-col justify-between transition-all duration-300 border-r border-sidebar-border sticky top-0 h-screen shrink-0",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {sidebarContent(false)}
    </aside>
  );
}

/**
 * Hamburger trigger used by the DashboardLayout header on mobile.
 * Lives here so it shares the same `mobileOpen` state via a custom event,
 * keeping the API tiny without a context.
 */
export function MobileSidebarTrigger() {
  const isMobile = useIsMobile();
  if (!isMobile) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Abrir menu"
      onClick={() => window.dispatchEvent(new CustomEvent('mesaclik:open-sidebar'))}
      className="h-9 w-9 mr-auto"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
