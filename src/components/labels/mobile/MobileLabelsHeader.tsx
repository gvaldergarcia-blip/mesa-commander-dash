import { useEffect, useRef } from "react";
import { CalendarDays, LayoutDashboard, Package, PackageX, RefreshCw, Tag, Truck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MobileSidebarTrigger } from "@/components/layout/Sidebar";
import { ThemeToggle } from "@/components/layout/ThemeToggle";

export const MOBILE_LABEL_TABS = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "imprimir", label: "Imprimir", icon: Zap },
  { value: "hoje", label: "Hoje", icon: CalendarDays },
  { value: "renovacao", label: "Renovação", icon: RefreshCw },
  { value: "recebimento", label: "Recebimento", icon: Truck },
  { value: "estoque", label: "Estoque", icon: PackageX },
  { value: "cadastro", label: "Cadastro", icon: Package },
] as const;

interface MobileLabelsHeaderProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MobileLabelsHeader({ activeTab, onTabChange }: MobileLabelsHeaderProps) {
  const current = MOBILE_LABEL_TABS.find((item) => item.value === activeTab) ?? MOBILE_LABEL_TABS[0];
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  useEffect(() => {
    itemRefs.current[activeTab]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeTab]);

  return (
    <>
      <header className="sticky top-0 z-40 -mx-3 -mt-3 flex h-14 items-center gap-2 border-b border-border bg-background px-3 md:hidden">
        <MobileSidebarTrigger />
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-primary/30 bg-primary/10 text-primary">
          <Tag className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase leading-none text-primary">Etiquetas</p>
          <h1 className="truncate text-base font-bold leading-tight">{current.label}</h1>
        </div>
        <div className="ml-auto shrink-0"><ThemeToggle /></div>
      </header>
      <nav
        aria-label="Telas de Etiquetas"
        className="scrollbar-none fixed inset-x-0 bottom-0 z-40 overflow-x-auto overscroll-x-contain border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        <div className="flex w-max min-w-full px-1.5 py-1.5">
          {MOBILE_LABEL_TABS.map((item) => {
            const Icon = item.icon;
            const active = item.value === activeTab;
            return (
              <Button
                ref={(node) => { itemRefs.current[item.value] = node; }}
                key={item.value}
                type="button"
                variant="ghost"
                onClick={() => onTabChange(item.value)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "h-14 min-w-[72px] shrink-0 flex-col gap-1 rounded-md px-2 text-[11px] font-semibold",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {item.label}
              </Button>
            );
          })}
        </div>
      </nav>
    </>
  );
}