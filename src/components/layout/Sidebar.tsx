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
  ChefHat,
  Menu,
  X,
  Brain
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FEATURE_FLAGS } from "@/config/feature-flags";
import { ThemeToggle } from "./ThemeToggle";

const allNavigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, requiresFeature: null },
  { name: "Fila", href: "/queue", icon: Users, requiresFeature: null },
  { name: "Reservas", href: "/reservations", icon: Calendar, requiresFeature: null },
  { name: "Clientes", href: "/customers", icon: UserCheck, requiresFeature: null },
  { name: "Palpites", href: "/intelligence", icon: Brain, requiresFeature: null },
  { name: "Promoções", href: "/promotions", icon: Megaphone, requiresFeature: "CUPONS_ENABLED" as const },
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

  return (
    <div className={cn(
      "bg-sidebar-background text-sidebar-foreground flex flex-col transition-all duration-300 border-r border-sidebar-border",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <div className={cn(
          "flex items-center space-x-3 transition-opacity",
          isCollapsed && "opacity-0 w-0 overflow-hidden"
        )}>
          <div className="bg-primary p-2 rounded-lg">
            <ChefHat className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold">MesaClik</h1>
            <p className="text-xs text-sidebar-foreground/70">Painel de Controle</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group relative",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/80 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className={cn(
              "ml-3 transition-opacity duration-200",
              isCollapsed && "opacity-0 w-0 overflow-hidden"
            )}>
              {item.name}
            </span>
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 shadow-md border">
                {item.name}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer with Theme Toggle */}
      <div className="p-4 border-t border-sidebar-border space-y-3">
        {/* Theme Toggle */}
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center" : "justify-between"
        )}>
          {!isCollapsed && (
            <span className="text-xs text-sidebar-foreground/70">Tema</span>
          )}
          <ThemeToggle />
        </div>
        
        {/* User Info */}
        <div className={cn(
          "flex items-center space-x-3",
          isCollapsed && "justify-center"
        )}>
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-primary-foreground">R</span>
          </div>
          <div className={cn(
            "transition-opacity duration-200 min-w-0",
            isCollapsed && "opacity-0 w-0 overflow-hidden"
          )}>
            <p className="text-sm font-medium truncate">Restaurante Demo</p>
            <p className="text-xs text-sidebar-foreground/70">Administrador</p>
          </div>
        </div>
      </div>
    </div>
  );
}
