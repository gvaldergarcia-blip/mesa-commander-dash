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
    <div className="flex h-[100dvh] min-h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden min-w-0">
        {/* Header com toggle de tema */}
        <header className={labelsMobileHeader ? "hidden h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:flex md:px-6" : "flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:px-6"}>
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
