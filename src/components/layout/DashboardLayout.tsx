import { Sidebar, MobileSidebarTrigger } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { useLocation } from "react-router-dom";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const labelsMobileHeader = location.pathname === "/etiquetas";

  return (
    <div className="flex h-[100dvh] min-h-0 overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header com toggle de tema */}
        <header className={labelsMobileHeader ? "hidden h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:flex md:px-6" : "flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:px-6"}>
          <MobileSidebarTrigger />
          <ThemeToggle />
        </header>
        <main className="mobile-main-scroll min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
