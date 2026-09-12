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
    <div className="flex min-h-[100dvh] bg-background md:h-[100dvh] md:min-h-0 md:overflow-hidden">
      <Sidebar />
      <div className="flex min-h-[100dvh] min-w-0 flex-1 flex-col md:min-h-0 md:overflow-hidden">
        {/* Header com toggle de tema */}
        <header className={labelsMobileHeader ? "hidden h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:flex md:px-6" : "flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:px-6"}>
          <MobileSidebarTrigger />
          <ThemeToggle />
        </header>
        <main className="min-w-0 flex-1 overflow-x-clip md:min-h-0 md:overflow-x-hidden md:overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
