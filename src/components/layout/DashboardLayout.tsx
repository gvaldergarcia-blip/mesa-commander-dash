import { Sidebar, MobileSidebarTrigger } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex h-[100dvh] min-h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden min-w-0">
        {/* Header com toggle de tema */}
        <header className="h-14 border-b border-border bg-card flex items-center justify-between gap-2 px-3 md:px-6 shrink-0">
          <MobileSidebarTrigger />
          <ThemeToggle />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain">
          {children}
        </main>
      </div>
    </div>
  );
}
