import { useState, useEffect } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput, isValidBrazilianPhone } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRestaurant } from "@/contexts/RestaurantContext";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (customerId?: string) => void;
  prefillName?: string;
  prefillPhone?: string;
};

const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

export function CreateCustomerSmartDialog({
  open,
  onOpenChange,
  onSuccess,
  prefillName = "",
  prefillPhone = "",
}: Props) {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [birthday, setBirthday] = useState("");

  useEffect(() => {
    if (open) {
      setName(prefillName);
      setPhone(prefillPhone);
      setEmail("");
      setBirthday("");
    }
  }, [open, prefillName, prefillPhone]);

  const reset = () => {
    setName("");
    setPhone("");
    setEmail("");
    setBirthday("");
  };

  const handleSubmit = async () => {
    if (!restaurantId) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      toast({ title: "Erro", description: "Nome é obrigatório.", variant: "destructive" });
      return;
    }
    if (!phone || !isValidBrazilianPhone(phone)) {
      toast({
        title: "Erro",
        description: "Celular válido é obrigatório: (XX) 9XXXX-XXXX",
        variant: "destructive",
      });
      return;
    }
    if (trimmedEmail && !emailRegex.test(trimmedEmail)) {
      toast({ title: "Erro", description: "E-mail inválido.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const phoneDigits = phone.replace(/\D/g, "");
      const finalEmail = trimmedEmail || `${phoneDigits}@phone.local`;

      const { data: customerId, error } = await supabase.rpc("upsert_restaurant_customer", {
        p_restaurant_id: restaurantId,
        p_email: finalEmail,
        p_name: trimmedName,
        p_phone: phone.trim(),
        p_source: "manual",
        p_marketing_optin: false,
        p_opt_in_source: null,
      });

      if (error) throw error;

      // Save birthday if informed
      if (customerId && birthday) {
        await supabase
          .from("restaurant_customers")
          .update({ birthday })
          .eq("id", customerId)
          .eq("restaurant_id", restaurantId);
      }

      // Register first visit automatically
      if (customerId) {
        try {
          await supabase.rpc("register_customer_visit", {
            p_restaurant_id: restaurantId,
            p_email: finalEmail,
            p_name: trimmedName,
            p_phone: phone.trim(),
            p_source: "registro_manual",
            p_notes: "Primeira visita (busca inteligente)",
          });

          await supabase.functions.invoke("loyalty-enroll", {
            body: {
              restaurant_id: restaurantId,
              action: "check_reward",
              customer_id: customerId,
            },
          });
        } catch (e) {
          console.warn("Visit/loyalty registration failed:", e);
        }
      }

      toast({
        title: "Cliente cadastrado e visita registrada ✓",
        description: `${trimmedName} foi adicionado ao CRM.`,
      });
      reset();
      onOpenChange(false);
      onSuccess(customerId as string | undefined);
    } catch (err: any) {
      const msg = err?.message?.includes("duplicate")
        ? "Cliente já cadastrado."
        : err?.message || "Erro ao cadastrar cliente";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Cadastrar novo cliente
          </DialogTitle>
          <DialogDescription>
            A primeira visita será registrada automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="smart-name">Nome completo *</Label>
            <Input
              id="smart-name"
              placeholder="Nome do cliente"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smart-phone">Telefone *</Label>
            <PhoneInput id="smart-phone" value={phone} onChange={setPhone} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smart-email">E-mail (opcional)</Label>
            <Input
              id="smart-email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={320}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="smart-birthday">Aniversário (opcional)</Label>
            <Input
              id="smart-birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Cadastrar e registrar visita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
