import { useState, useEffect } from "react";
import { Search, UserPlus, ClipboardCheck, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const [step, setStep] = useState<'search' | 'register' | 'new_customer_warning'>('search');
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

  const normalizePhone = (value: string) => value.replace(/\D/g, "");

  const extractErrorMessage = (err: unknown) => {
    if (err instanceof Error) return err.message;
    if (typeof err === 'object' && err !== null && 'message' in err) {
      const message = (err as { message?: unknown }).message;
      if (typeof message === 'string') return message;
    }
    return "Erro ao registrar visita";
  };

  const findBestCustomerMatch = (customers: any[], rawQuery: string) => {
    const query = rawQuery.trim().toLowerCase();
    const queryDigits = normalizePhone(rawQuery);

    const byExactEmail = customers.find(
      (customer) => (customer.customer_email || "").toLowerCase() === query,
    );
    if (byExactEmail) return byExactEmail;

    if (queryDigits.length >= 8) {
      const byExactPhone = customers.find(
        (customer) => normalizePhone(customer.customer_phone || "") === queryDigits,
      );
      if (byExactPhone) return byExactPhone;

      const byPhoneIncludes = customers.find(
        (customer) => normalizePhone(customer.customer_phone || "").includes(queryDigits),
      );
      if (byPhoneIncludes) return byPhoneIncludes;
    }

    const byExactName = customers.find(
      (customer) => (customer.customer_name || "").toLowerCase() === query,
    );
    if (byExactName) return byExactName;

    return customers[0];
  };

  const searchCustomers = async (rawQuery: string) => {
    if (!restaurantId) return [] as any[];

    const query = rawQuery.trim().toLowerCase();
    const queryDigits = normalizePhone(rawQuery);

    const { data } = await supabase
      .from('restaurant_customers')
      .select('id, customer_email, customer_name, customer_phone, total_visits, vip')
      .eq('restaurant_id', restaurantId)
      .or(`customer_email.ilike.%${query}%,customer_phone.ilike.%${query}%,customer_name.ilike.%${query}%`)
      .limit(20);

    let candidates = data || [];

    // Fallback para telefone normalizado (evita falhas por máscara/formatação)
    if (candidates.length === 0 && queryDigits.length >= 8) {
      const { data: phoneFallbackData } = await supabase
        .from('restaurant_customers')
        .select('id, customer_email, customer_name, customer_phone, total_visits, vip')
        .eq('restaurant_id', restaurantId)
        .limit(200);

      candidates = (phoneFallbackData || []).filter((customer) =>
        normalizePhone(customer.customer_phone || '').includes(queryDigits),
      );
    }

    return candidates;
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !restaurantId) return;
    setSearching(true);
    try {
      const rawQuery = searchQuery.trim();
      const candidates = await searchCustomers(rawQuery);
      const queryDigits = normalizePhone(rawQuery);

      if (candidates.length > 0) {
        const matchedCustomer = findBestCustomerMatch(candidates, rawQuery);
        setFoundCustomer(matchedCustomer);
        setEmail(matchedCustomer.customer_email);
        setName(matchedCustomer.customer_name || '');
        setPhone(matchedCustomer.customer_phone || '');
        setStep('register');
      } else {
        const isEmail = rawQuery.includes('@');
        const isPhone = queryDigits.length >= 8;

        setEmail(isEmail ? rawQuery : '');
        setPhone(isPhone ? rawQuery : '');
        setName(!isEmail && !isPhone ? rawQuery : '');
        setFoundCustomer(null);
        setStep('new_customer_warning');
      }
    } catch (err) {
      toast({ title: 'Erro na busca', description: extractErrorMessage(err), variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const handleStartNewCustomerRegistration = async () => {
    if (!restaurantId) return;

    const rawQuery = searchQuery.trim();

    // Sem busca preenchida: segue para aviso de não cadastrado
    if (!rawQuery) {
      setFoundCustomer(null);
      setStep('new_customer_warning');
      return;
    }

    setSearching(true);
    try {
      const candidates = await searchCustomers(rawQuery);
      const queryDigits = normalizePhone(rawQuery);

      if (candidates.length > 0) {
        const matchedCustomer = findBestCustomerMatch(candidates, rawQuery);
        setFoundCustomer(matchedCustomer);
        setEmail(matchedCustomer.customer_email);
        setName(matchedCustomer.customer_name || '');
        setPhone(matchedCustomer.customer_phone || '');
        setStep('register');

        toast({
          title: 'Cliente já cadastrado',
          description: `O cliente ${matchedCustomer.customer_name || matchedCustomer.customer_email} já está cadastrado.`,
          variant: 'destructive',
        });
        return;
      }

      const isEmail = rawQuery.includes('@');
      const isPhone = queryDigits.length >= 8;

      setEmail(isEmail ? rawQuery : '');
      setPhone(isPhone ? rawQuery : '');
      setName(!isEmail && !isPhone ? rawQuery : '');
      setFoundCustomer(null);
      setStep('new_customer_warning');
    } catch (err) {
      toast({ title: 'Erro na validação', description: extractErrorMessage(err), variant: 'destructive' });
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !restaurantId) {
      toast({ title: 'E-mail é obrigatório', variant: 'destructive' });
      return;
    }

    if (!foundCustomer) {
      setStep('new_customer_warning');
      toast({
        title: 'Cliente não cadastrado',
        description: `O cliente ${name || email || phone || searchQuery || 'informado'} não está cadastrado. Cadastre primeiro para depois registrar visita.`,
        variant: 'destructive',
      });
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
        title: '✅ Visita registrada!',
        description: `Visita de ${foundCustomer.customer_name || name || email} registrada com sucesso`,
      });
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      toast({
        title: "Erro",
        description: extractErrorMessage(err),
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
              onClick={handleStartNewCustomerRegistration}
              disabled={searching}
            >
              <UserPlus className="h-4 w-4" />
              Cadastrar novo cliente
            </Button>
          </div>
        )}

        {step === 'new_customer_warning' && (
          <div className="space-y-4">
            <Alert variant="destructive" className="border-orange-300 bg-orange-50 text-orange-900 dark:bg-orange-950/30 dark:text-orange-200 dark:border-orange-800">
              <AlertTriangle className="h-4 w-4 !text-orange-600" />
              <AlertDescription className="text-sm">
                <strong>Cliente não cadastrado.</strong> O cliente <strong>{name || email || phone || searchQuery || 'informado'}</strong> não possui cadastro e não pode ter visita registrada agora. Primeiro faça o cadastro do cliente e só depois registre a visita.
              </AlertDescription>
            </Alert>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setStep('search')}>
                Voltar
              </Button>
              <Button className="flex-1" onClick={() => onOpenChange(false)}>
                Entendi
              </Button>
            </div>
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
