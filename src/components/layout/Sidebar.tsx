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
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Fila", href: "/queue", icon: Users },
  { name: "Reservas", href: "/reservations", icon: Calendar },
  { name: "Clientes", href: "/customers", icon: UserCheck },
  { name: "Promoções", href: "/promotions", icon: Megaphone },
  { name: "Relatórios", href: "/reports", icon: BarChart3 },
  { name: "Configurações", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className={cn(
      "bg-sidebar-bg text-sidebar-fg flex flex-col transition-all duration-300",
      isCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-accent/20">
        <div className={cn(
          "flex items-center space-x-3 transition-opacity",
          isCollapsed && "opacity-0"
        )}>
          <div className="bg-primary p-2 rounded-lg">
            <ChefHat className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-sidebar-fg">MesaClik</h1>
            <p className="text-xs text-sidebar-fg/70">Painel de Controle</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-sidebar-fg hover:bg-sidebar-accent/20"
        >
          {isCollapsed ? <Menu className="h-4 w-4" /> : <X className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-4 space-y-2">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.href}
            end={item.href === "/"}
            className={({ isActive }) =>
              cn(
                "flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors group relative",
                isActive
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-sidebar-fg/80 hover:text-sidebar-fg hover:bg-sidebar-accent/20"
              )
            }
          >
            <item.icon className="h-5 w-5 shrink-0" />
            <span className={cn(
              "ml-3 transition-opacity",
              isCollapsed && "opacity-0"
            )}>
              {item.name}
            </span>
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                {item.name}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-accent/20">
        <div className={cn(
          "flex items-center space-x-3",
          isCollapsed && "justify-center"
        )}>
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <span className="text-xs font-medium text-primary-foreground">R</span>
          </div>
          <div className={cn(
            "transition-opacity",
            isCollapsed && "opacity-0"
          )}>
            <p className="text-sm font-medium text-sidebar-fg">Restaurante Demo</p>
            <p className="text-xs text-sidebar-fg/70">Administrador</p>
          </div>
        </div>
      </div>
    </div>
  );
}