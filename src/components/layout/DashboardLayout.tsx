import { useEffect, useRef } from "react";
import { Sidebar, MobileSidebarTrigger } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { useLocation } from "react-router-dom";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const location = useLocation();
  const labelsMobileHeader = location.pathname === "/etiquetas";
  const scrollerRef = useRef<HTMLDivElement>(null);

  // iOS: quando a rolagem encosta no topo/fim, o próximo gesto "vaza" para a
  // página (ou o app) que envolve o MesaClik e a tela parece travar. Mantendo
  // a área sempre 1px longe das bordas, o gesto fica sempre dentro dela.
  // O ajuste é feito quando a rolagem para (não no toque), para não "engolir"
  // o primeiro gesto do usuário.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let timer: number | undefined;
    let touching = false;
    const nudge = () => {
      if (touching || window.innerWidth >= 768) return;
      const max = el.scrollHeight - el.clientHeight;
      if (max <= 2) return;
      if (el.scrollTop <= 0) el.scrollTop = 1;
      else if (el.scrollTop >= max) el.scrollTop = max - 1;
    };
    const onScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(nudge, 120);
    };
    const onStart = () => { touching = true; window.clearTimeout(timer); };
    const onEnd = () => { touching = false; window.clearTimeout(timer); timer = window.setTimeout(nudge, 120); };
    nudge();
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, []);

  return (
    <div
      ref={scrollerRef}
      className="flex max-w-full bg-background max-md:fixed max-md:inset-0 max-md:overflow-x-hidden max-md:overflow-y-auto max-md:overscroll-y-contain md:h-[100dvh] md:overflow-hidden"
      style={{ WebkitOverflowScrolling: "touch" }}
    >
      <Sidebar />
      <div className="flex min-h-full min-w-0 flex-1 flex-col md:min-h-0 md:overflow-hidden">
        {/* Header com toggle de tema */}
        <header className={labelsMobileHeader ? "hidden h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:flex md:px-6" : "flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 md:px-6"}>
          <MobileSidebarTrigger />
          <ThemeToggle />
        </header>
        <main className="min-w-0 flex-1 md:min-h-0 md:overflow-x-hidden md:overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
