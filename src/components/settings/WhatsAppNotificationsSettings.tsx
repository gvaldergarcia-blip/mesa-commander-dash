import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, Loader2, RefreshCw, Send, CheckCircle2, XCircle, Users, History, Play, ShieldCheck,
} from "lucide-react";
import {
  NOTIFICATION_CATEGORIES,
  useWhatsAppLogs,
  useWhatsAppNotifications,
} from "@/hooks/useWhatsAppNotifications";
import { useLabelEmployees } from "@/hooks/useLabelEmployees";
import { cn } from "@/lib/utils";

function maskPhone(phone: string | null) {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length < 6) return phone || "—";
  return `+${d.slice(0, d.length - 4).replace(/\d(?=\d{2})/g, "•")}${d.slice(-4)}`;
}

export function WhatsAppNotificationsSettings() {
  const {
    settings, isLoading, save, isSaving, checkConnection, isChecking,
    sendTest, isSendingTest, runNow, isRunning,
  } = useWhatsAppNotifications();
  const { employees } = useLabelEmployees();
  const { logs, isLoading: loadingLogs } = useWhatsAppLogs();
  const [testTarget, setTestTarget] = useState<string>("");

  if (isLoading || !settings) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const connected = settings.connection_status === "connected";
  const events = settings.events || {};
  const recipients = employees.filter((e) => e.status === "active" && e.whatsapp_phone && e.notifications_enabled !== false);

  const toggleEvent = (key: string, value: boolean) =>
    save({ events: { ...events, [key]: value } });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            WhatsApp / Notificações
            <Badge className={cn("border", connected
              ? "bg-green-500/15 text-green-600 border-green-500/30"
              : "bg-muted text-muted-foreground border-border")}
            >
              {connected ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
              {connected ? "Conectado" : "Desconectado"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Notificações operacionais enviadas pelo WhatsApp usando os mesmos dados e regras do MesaClik.
            As credenciais ficam apenas no backend.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border/60 bg-muted/20 p-4">
            <div>
              <Label className="text-base">Ativar notificações por WhatsApp</Label>
              <p className="text-sm text-muted-foreground">Nenhuma mensagem é enviada enquanto estiver desligado.</p>
            </div>
            <Switch checked={settings.enabled} disabled={isSaving} onCheckedChange={(v) => save({ enabled: v })} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => checkConnection()} disabled={isChecking} className="gap-2">
              {isChecking ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Verificar conexão
            </Button>
            <Button variant="outline" size="sm" onClick={() => runNow()} disabled={isRunning || !settings.enabled} className="gap-2">
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Processar eventos agora
            </Button>
          </div>
          {settings.last_error && (
            <p className="text-xs text-destructive">{settings.last_error}</p>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="events" className="space-y-4">
        <TabsList>
          <TabsTrigger value="events" className="gap-2"><ShieldCheck className="h-4 w-4" /> Eventos</TabsTrigger>
          <TabsTrigger value="people" className="gap-2"><Users className="h-4 w-4" /> Funcionários</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" /> Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-4">
          {NOTIFICATION_CATEGORIES.map((cat) => (
            <Card key={cat.category}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{cat.category}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cat.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm">{item.label}</Label>
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    </div>
                    <Switch
                      checked={!!events[item.key]}
                      disabled={isSaving}
                      onCheckedChange={(v) => toggleEvent(item.key, v)}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Controle de envio</CardTitle>
              <CardDescription>Evita mensagens repetidas e envios em horário inadequado.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Silêncio a partir de</Label>
                <Select value={String(settings.quiet_hours_start)} onValueChange={(v) => save({ quiet_hours_start: Number(v) })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Silêncio até</Label>
                <Select value={String(settings.quiet_hours_end)} onValueChange={(v) => save({ quiet_hours_end: Number(v) })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }, (_, h) => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Não repetir o mesmo aviso por</Label>
                <Select value={String(settings.dedupe_window_hours)} onValueChange={(v) => save({ dedupe_window_hours: Number(v) })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[4, 6, 12, 24, 48].map((h) => (
                      <SelectItem key={h} value={String(h)}>{h} horas</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="people">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Quem recebe as mensagens</CardTitle>
              <CardDescription>
                Gerencie os funcionários em Etiquetas → Cadastro → Funcionários.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recipients.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Nenhum funcionário ativo com WhatsApp e permissão de notificações.
                </p>
              ) : (
                recipients.map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{e.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {[e.role || "—", maskPhone(e.whatsapp_phone)].join(" · ")}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {(e.notification_types?.length ?? 0) === 0
                          ? "Todos os eventos ativos"
                          : `${e.notification_types!.length} tipo(s) selecionado(s)`}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 shrink-0"
                      disabled={isSendingTest}
                      onClick={() => { setTestTarget(e.id); sendTest(e.whatsapp_phone!); }}
                    >
                      {isSendingTest && testTarget === e.id
                        ? <Loader2 className="h-4 w-4 animate-spin" />
                        : <Send className="h-4 w-4" />}
                      Testar
                    </Button>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Histórico de notificações</CardTitle>
              <CardDescription>Evento, destinatário, mensagem, data e status.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {loadingLogs ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div>
              ) : logs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma notificação enviada ainda.</p>
              ) : (
                logs.map((log) => {
                  const ok = log.status === "sent" || log.status === "delivered" || log.status === "read";
                  return (
                    <div key={log.id} className="flex items-start gap-3 rounded-lg border border-border/60 p-3">
                      <div className={cn("mt-0.5 p-1.5 rounded-full", ok ? "bg-emerald-500/10" : "bg-destructive/10")}>
                        {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{log.employee?.name || maskPhone(log.phone)}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                            {log.event_type || "evento"}
                          </span>
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(log.sent_at).toLocaleString("pt-BR")}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-line line-clamp-3">{log.message}</p>
                        {log.error && <p className="text-xs text-destructive mt-1">{log.error}</p>}
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Webhook Z-API: <code>{`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/zapi-webhook?s=SEU_SEGREDO`}</code> —
        configure esta URL em "Ao receber" no painel da Z-API.
      </p>
    </div>
  );
}