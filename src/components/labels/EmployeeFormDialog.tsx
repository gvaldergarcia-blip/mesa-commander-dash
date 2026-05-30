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
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (open) {
      setName(employee?.name ?? "");
      setRole(employee?.role ?? "");
      setPin(employee?.pin ?? "");
      setWhatsapp(employee?.whatsapp_phone ?? "");
      setStatus(employee?.status ?? "active");
    }
  }, [open, employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (pin && !/^[0-9]{4}$/.test(pin)) return;
    await onSubmit({ name, role, pin: pin || null, whatsapp_phone: whatsapp || null, status });
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
          message: `Olá ${name || "funcionário"}! Esta é uma mensagem de teste do MesaClik Etiquetas. Você receberá lembretes de tarefas por aqui.`,
        },
      });
      if (error) throw error;
      if ((data as any)?.whatsapp?.success) toast.success("WhatsApp de teste enviado!");
      else if ((data as any)?.sms?.success) toast.success("SMS enviado (WhatsApp falhou — verifique o sandbox)");
      else toast.error((data as any)?.message || "Falha ao enviar mensagem");
    } catch (e: any) {
      toast.error(e.message || "Erro ao enviar teste");
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
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
              <Label>PIN (4 dígitos)</Label>
              <Input value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Opcional" />
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
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button type="submit" disabled={isSubmitting}>{employee ? "Salvar" : "Cadastrar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}