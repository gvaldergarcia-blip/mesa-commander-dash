import { useState } from "react";
import { useLabelSmsLogs, LabelSmsLog } from "@/hooks/useLabelSmsLogs";
import { Card } from "@/components/ui/card";
import { Loader2, MessageSquare, CheckCircle2, XCircle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const kindLabel: Record<LabelSmsLog["kind"], string> = {
  daily: "Diário",
  expiry_alert: "Alerta vencimento",
  test: "Teste",
  manual: "Manual",
};

function mask(phone: string) {
  const d = phone.replace(/\D/g, "");
  if (d.length < 6) return phone;
  return `(${d.slice(-11, -9)}) •••• ${d.slice(-4)}`;
}

export function SmsLogsTab() {
  const { logs, isLoading } = useLabelSmsLogs();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-16 border border-dashed border-border/50 rounded-2xl text-muted-foreground">
        <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p>Nenhum SMS enviado ainda.</p>
        <p className="text-xs mt-1">Os relatórios diários e alertas aparecerão aqui.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {logs.map((log) => {
        const ok = log.status !== "failed";
        const isOpen = expanded === log.id;
        return (
          <Card
            key={log.id}
            className={cn(
              "p-4 transition-colors cursor-pointer hover:bg-muted/30",
              isOpen && "bg-muted/30"
            )}
            onClick={() => setExpanded(isOpen ? null : log.id)}
          >
            <div className="flex items-start gap-3">
              <div className={cn("mt-1 p-1.5 rounded-full", ok ? "bg-emerald-500/10" : "bg-destructive/10")}>
                {ok ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{log.employee?.name || "—"}</span>
                    <span className="text-xs text-muted-foreground">{mask(log.phone)}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {kindLabel[log.kind]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.sent_at).toLocaleString("pt-BR")}
                    </span>
                    <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </div>
                </div>
                <p className={cn("text-sm text-muted-foreground mt-1", !isOpen && "line-clamp-1")}>
                  {log.message}
                </p>
                {isOpen && log.error && (
                  <p className="text-xs text-destructive mt-2 font-mono">{log.error}</p>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}