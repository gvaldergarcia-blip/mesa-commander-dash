import { LayoutDashboard, Package, PackageX, RefreshCw, Tag, Truck, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const MOBILE_LABEL_TABS = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "imprimir", label: "Imprimir", icon: Zap },
  { value: "renovacao", label: "Renovação", icon: RefreshCw },
  { value: "recebimento", label: "Recebimento", icon: Truck },
  { value: "estoque", label: "Estoque", icon: PackageX },
  { value: "cadastro", label: "Cadastro", icon: Package },
  { value: "funcionarios", label: "Funcionários", icon: Users },
] as const;

interface MobileLabelsHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MobileLabelsHeader({ activeTab, onTabChange }: MobileLabelsHeaderProps) {
  const current = MOBILE_LABEL_TABS.find((item) => item.value === activeTab) ?? MOBILE_LABEL_TABS[0];

  return (
    <div className="sticky top-0 z-40 -mx-3 -mt-3 border-b border-border bg-background/95 backdrop-blur md:hidden">
      <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 text-primary">
          <Tag className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-primary">Etiquetas</p>
          <h1 className="truncate text-lg font-bold leading-tight">{current.label}</h1>
        </div>
      </div>
      <nav aria-label="Telas de Etiquetas" className="scrollbar-none overflow-x-auto overscroll-x-contain px-3 pb-2">
        <div className="flex w-max gap-1.5">
          {MOBILE_LABEL_TABS.map((item) => {
            const Icon = item.icon;
            const active = item.value === activeTab;
            return (
              <Button
                key={item.value}
                type="button"
                variant={active ? "default" : "ghost"}
                onClick={() => onTabChange(item.value)}
                aria-current={active ? "page" : undefined}
                className={cn("h-10 shrink-0 gap-2 px-3 text-sm", !active && "border border-border bg-card")}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}