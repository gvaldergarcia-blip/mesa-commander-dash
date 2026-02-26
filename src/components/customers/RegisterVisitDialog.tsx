import { useState, useEffect } from "react";
import { Search, UserPlus, ClipboardCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";

interface RegisterVisitDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  prefillEmail?: string;
  prefillName?: string;
  prefillPhone?: string;
}

export function RegisterVisitDialog({
  open, onOpenChange, onSuccess,
  prefillEmail, prefillName, prefillPhone,
}: RegisterVisitDialogProps) {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [step, setStep] = useState<'search' | 'register'>('search');
  const [searchQuery, setSearchQuery] = useState("");
  const [foundCustomer, setFoundCustomer] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form fields
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("registro_manual");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) {
      if (prefillEmail) {
        setEmail(prefillEmail);
        setName(prefillName || "");
        setPhone(prefillPhone || "");
        setStep('register');
        setFoundCustomer({ customer_email: prefillEmail, customer_name: prefillName });
      } else {
        resetForm();
      }
    }
  }, [open, prefillEmail, prefillName, prefillPhone]);

  const resetForm = () => {
    setStep('search');
    setSearchQuery("");
    setFoundCustomer(null);
    setEmail("");
    setName("");
    setPhone("");
    setSource("registro_manual");
    setNotes("");
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !restaurantId) return;
    setSearching(true);
    try {
      const query = searchQuery.trim().toLowerCase();
      const { data } = await supabase
        .from('restaurant_customers')
        .select('id, customer_email, customer_name, customer_phone, total_visits, vip')
        .eq('restaurant_id', restaurantId)
        .or(`customer_email.ilike.%${query}%,customer_phone.ilike.%${query}%,customer_name.ilike.%${query}%`)
        .limit(5);

      if (data && data.length > 0) {
        setFoundCustomer(data[0]);
        setEmail(data[0].customer_email);
        setName(data[0].customer_name || "");
        setPhone(data[0].customer_phone || "");
        setStep('register');
      } else {
        // Not found - allow creating new
        const isEmail = query.includes('@');
        setEmail(isEmail ? query : "");
        setPhone(!isEmail ? query : "");
        setFoundCustomer(null);
        setStep('register');
      }
    } catch {
      toast({ title: "Erro na busca", variant: "destructive" });
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !restaurantId) {
      toast({ title: "E-mail é obrigatório", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('register_customer_visit', {
        p_restaurant_id: restaurantId,
        p_email: email.trim(),
        p_name: name.trim() || null,
        p_phone: phone.trim() || null,
        p_source: source,
        p_notes: notes.trim() || null,
      });

      if (error) throw error;
      const result = data as any;
      if (!result?.success) throw new Error(result?.error || 'Erro ao registrar');

      toast({
        title: "✅ Visita registrada!",
        description: foundCustomer
          ? `Visita de ${name || email} registrada com sucesso`
          : `Novo cliente criado e visita registrada`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Erro",
        description: err instanceof Error ? err.message : "Erro ao registrar visita",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Registrar Visita
          </DialogTitle>
        </DialogHeader>

        {step === 'search' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Busque o cliente por e-mail, telefone ou nome
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Email, telefone ou nome..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                autoFocus
              />
              <Button onClick={handleSearch} disabled={searching || !searchQuery.trim()}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => { setFoundCustomer(null); setStep('register'); }}
            >
              <UserPlus className="h-4 w-4" />
              Cadastrar novo cliente
            </Button>
          </div>
        )}

        {step === 'register' && (
          <div className="space-y-4">
            {foundCustomer && (
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <p className="font-medium">{foundCustomer.customer_name || 'Cliente'}</p>
                <p className="text-muted-foreground">{foundCustomer.customer_email}</p>
                {foundCustomer.total_visits !== undefined && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {foundCustomer.total_visits} visitas • {foundCustomer.vip ? '⭐ VIP' : 'Regular'}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>E-mail *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="cliente@email.com"
                disabled={!!foundCustomer}
              />
            </div>

            {!foundCustomer && (
              <>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome do cliente" />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-0000" />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Origem da visita</Label>
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="registro_manual">Registro manual</SelectItem>
                  <SelectItem value="fila">Fila</SelectItem>
                  <SelectItem value="reserva">Reserva</SelectItem>
                  <SelectItem value="qr_checkin">QR Check-in</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observação (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: mesa 5, aniversário..."
                rows={2}
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('search')}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={handleSubmit} disabled={submitting || !email.trim()}>
                {submitting ? 'Registrando...' : 'Registrar visita'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
