import { useState } from "react";
import { NavLink } from "react-router-dom";
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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURE_FLAGS } from "@/config/feature-flags";
import { useTheme } from "@/hooks/useTheme";
import { useRestaurant } from "@/contexts/RestaurantContext";

const allNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, requiresFeature: null },
  { name: "Fila", href: "/queue", icon: Users, requiresFeature: null },
  { name: "Reservas", href: "/reservations", icon: Calendar, requiresFeature: null },
  { name: "Clientes", href: "/customers", icon: UserCheck, requiresFeature: null },
  { name: "Promoções", href: "/promotions", icon: Megaphone, requiresFeature: "CUPONS_ENABLED" as const },
  { name: "Marketing IA", href: "/marketing/video", icon: Film, requiresFeature: "MARKETING_IA_ENABLED" as const },
  { name: "Relatórios", href: "/reports", icon: BarChart3, requiresFeature: null },
  { name: "Configurações", href: "/settings", icon: Settings, requiresFeature: null },
];

// Filtra itens de navegação com base nas feature flags
const navigation = allNavigation.filter((item) => {
  if (item.requiresFeature === null) return true;
  return FEATURE_FLAGS[item.requiresFeature];
});

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const { theme, toggleTheme } = useTheme();
  
  // Usar contexto dinâmico em vez de ID hardcoded
  const { restaurant } = useRestaurant();

  // Obter inicial do nome do restaurante para fallback
  const restaurantInitial = restaurant?.name?.charAt(0)?.toUpperCase() || 'R';

  return (
    <aside className={cn(
      "bg-sidebar-background text-sidebar-foreground flex flex-col justify-between transition-all duration-300 border-r border-sidebar-border sticky top-0 h-screen shrink-0",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Top Section: Header + Navigation */}
      <div>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-sidebar-border/50">
          <div className={cn(
            "flex items-center transition-all duration-200",
            isCollapsed && "opacity-0 w-0 overflow-hidden"
          )}>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-sidebar-foreground">MESA</span>
                <span className="text-primary">CLIK</span>
              </h1>
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">Painel</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
          >
            {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
          </Button>
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
                  isCollapsed && "opacity-0 w-0 overflow-hidden ml-0"
                )}>
                  {item.name}
                </span>
                
                {/* Tooltip for collapsed state */}
                {isCollapsed && (
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
            isCollapsed && "justify-center px-0"
          )}
        >
          {theme === "dark" ? (
            <Moon className="h-4 w-4 shrink-0" />
          ) : (
            <Sun className="h-4 w-4 shrink-0" />
          )}
          <span className={cn(
            "transition-all duration-200",
            isCollapsed && "opacity-0 w-0 overflow-hidden"
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
            isCollapsed && "justify-center px-0"
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          <span className={cn(
            "transition-all duration-200",
            isCollapsed && "opacity-0 w-0 overflow-hidden"
          )}>
            Sair
          </span>
        </button>
        
        {/* Restaurant Info - Exibe nome e logo oficiais das Configurações */}
        <div className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent/30",
          isCollapsed && "justify-center px-2"
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
            isCollapsed && "opacity-0 w-0 overflow-hidden"
          )}>
            <p className="text-sm font-medium truncate text-sidebar-foreground">
              {restaurant?.name || 'Carregando...'}
            </p>
            <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">Administrador</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
