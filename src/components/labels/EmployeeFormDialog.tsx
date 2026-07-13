import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LabelEmployee, LabelEmployeeInput } from "@/hooks/useLabelEmployees";
import { Button as UButton } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { PRODUCT_CATEGORIES } from "@/lib/labels/categories";
import { Switch } from "@/components/ui/switch";
import { Bell, MessageSquare } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee?: LabelEmployee | null;
  onSubmit: (input: LabelEmployeeInput) => Promise<unknown>;
  isSubmitting?: boolean;
}

export function EmployeeFormDialog({ open, onOpenChange, employee, onSubmit, isSubmitting }: Props) {
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [pin, setPin] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [sectors, setSectors] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [smsDaily, setSmsDaily] = useState(false);
  const [smsHour, setSmsHour] = useState(8);
  const [smsImmediate, setSmsImmediate] = useState(true);
  const [smsChecklists, setSmsChecklists] = useState(false);
  const [testingReport, setTestingReport] = useState(false);

  useEffect(() => {
    if (open) {
      setName(employee?.name ?? "");
      setRole(employee?.role ?? "");
      setPin(employee?.pin ?? "");
      setWhatsapp(employee?.whatsapp_phone ?? "");
      setStatus(employee?.status ?? "active");
      setSectors(employee?.sectors ?? []);
      setSmsDaily(employee?.sms_daily_enabled ?? false);
      setSmsHour(employee?.sms_daily_hour ?? 8);
      setSmsImmediate(employee?.sms_immediate_alerts ?? true);
      setSmsChecklists(employee?.sms_include_checklists ?? false);
    }
  }, [open, employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!/^[0-9]{4}$/.test(pin)) {
      toast.error("PIN obrigatório (4 dígitos)");
      return;
    }
    if (sectors.length === 0) {
      toast.error("Selecione ao menos um setor de responsabilidade");
      return;
    }
    await onSubmit({
      name, role, pin, whatsapp_phone: whatsapp || null, status, sectors,
      sms_daily_enabled: smsDaily,
      sms_daily_hour: smsHour,
      sms_immediate_alerts: smsImmediate,
      sms_include_checklists: smsChecklists,
    });
    onOpenChange(false);
  };

  const formatPhone = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  };

  const handleTest = async () => {
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Informe um WhatsApp válido com DDD");
      return;
    }
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: {
          to: digits.startsWith("55") ? `+${digits}` : `+55${digits}`,
          channel: "both",
          // Template aprovado (etiqueta_vencimento_alerta) — obrigatório fora da janela de 24h
          contentSid: "HX1207153b6f2d0899e229d61123f8712e",
          contentVariables: {
            "1": (name || "funcionário").split(" ")[0],
            "2": "Teste MesaClik",
            "3": "agora (mensagem de teste)",
          },
          message: `Olá ${name || "funcionário"}! Teste MesaClik Etiquetas.`,
        },
      });
      if (error) throw error;
      const smsOk = (data as any)?.sms?.success;
      const whatsappOk = (data as any)?.whatsapp?.success;
      const whatsappError = (data as any)?.whatsapp?.error;
      if (smsOk && whatsappOk) toast.success("Teste enviado por SMS e WhatsApp!");
      else if (smsOk) toast.success("SMS enviado");
      else if (whatsappOk) toast.success("WhatsApp de teste enviado!");
      else toast.error(whatsappError || (data as any)?.sms?.error || (data as any)?.message || "Falha ao enviar teste");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar teste");
    } finally {
      setTesting(false);
    }
  };

  const handleTestReport = async () => {
    if (!employee?.id) {
      toast.error("Salve o funcionário antes de testar o relatório");
      return;
    }
    const digits = whatsapp.replace(/\D/g, "");
    if (digits.length < 10) {
      toast.error("Informe um telefone válido com DDD");
      return;
    }
    setTestingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-label-daily-report", {
        body: {
          employee_id: employee.id,
          mode: "test",
          phone_override: digits.startsWith("55") ? `+${digits}` : `+55${digits}`,
        },
      });
      if (error) throw error;
      if ((data as any)?.success) toast.success("Relatório de teste enviado!");
      else toast.error((data as any)?.error || (data as any)?.sms?.message || "Falha ao enviar teste");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar relatório de teste");
    } finally {
      setTestingReport(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{employee ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle>
          <DialogDescription>
            Cadastre funcionários da cozinha para registrar quem imprime e quem dá baixa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome completo *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
          </div>
          <div className="space-y-2">
            <Label>Cargo / função</Label>
            <Input value={role} onChange={(e) => setRole(e.target.value)} maxLength={50} placeholder="Ex: Chef, Auxiliar" />
          </div>
          <div className="space-y-2">
            <Label>Setores responsáveis *</Label>
            <div className="grid grid-cols-2 gap-1.5 p-3 rounded-md border border-border/60 bg-muted/20 max-h-48 overflow-y-auto">
              {PRODUCT_CATEGORIES.map((cat) => {
                const checked = sectors.includes(cat);
                return (
                  <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer py-0.5">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(v) => {
                        setSectors((prev) =>
                          v ? [...prev, cat] : prev.filter((s) => s !== cat)
                        );
                      }}
                    />
                    <span className="truncate">{cat}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              Este funcionário ficará vinculado às etiquetas das categorias selecionadas.
            </p>
          </div>
          <div className="space-y-2">
            <Label>WhatsApp (com DDD)</Label>
            <div className="flex gap-2">
              <Input
                value={whatsapp}
                onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                placeholder="(11) 91234-5678"
                inputMode="tel"
              />
              <UButton type="button" variant="outline" size="sm" onClick={handleTest} disabled={testing} className="gap-1 shrink-0">
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Testar
              </UButton>
            </div>
            <p className="text-xs text-muted-foreground">Usado para enviar lembretes automáticos de tarefas e baixas.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>PIN (4 dígitos) *</Label>
              <Input
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="Ex: 1234"
                required
                inputMode="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Notificações SMS</span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Receber relatório diário</Label>
                <p className="text-xs text-muted-foreground">Resumo do status das etiquetas dos seus setores.</p>
              </div>
              <Switch checked={smsDaily} onCheckedChange={setSmsDaily} />
            </div>

            {smsDaily && (
              <div className="space-y-2 pl-1">
                <Label className="text-xs">Horário</Label>
                <Select value={String(smsHour)} onValueChange={(v) => setSmsHour(Number(v))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 18 }, (_, i) => i + 6).map((h) => (
                      <SelectItem key={h} value={String(h)}>{String(h).padStart(2, "0")}:00</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Alertas imediatos de vencimento</Label>
                <p className="text-xs text-muted-foreground">Avisa assim que uma etiqueta vence (ignora horário).</p>
              </div>
              <Switch checked={smsImmediate} onCheckedChange={setSmsImmediate} />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <Label className="text-sm">Incluir resumo de checklists</Label>
                <p className="text-xs text-muted-foreground">Adiciona pendências de checklists ao relatório.</p>
              </div>
              <Switch checked={smsChecklists} onCheckedChange={setSmsChecklists} />
            </div>

            <UButton
              type="button"
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleTestReport}
              disabled={testingReport || !employee?.id}
            >
              {testingReport ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
              Enviar teste agora
            </UButton>
            {!employee?.id && (
              <p className="text-[11px] text-muted-foreground text-center">Salve o cadastro para testar o envio.</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{employee ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}