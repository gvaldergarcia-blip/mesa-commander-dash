import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

type CreateCustomerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
};

export function CreateCustomerDialog({ open, onOpenChange, onSuccess }: CreateCustomerDialogProps) {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setNotes("");
  };

  const handleSubmit = async () => {
    if (!restaurantId) return;

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      toast({ title: "Erro", description: "Nome é obrigatório.", variant: "destructive" });
      return;
    }
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      toast({ title: "Erro", description: "E-mail inválido.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("upsert_restaurant_customer", {
        p_restaurant_id: restaurantId,
        p_email: trimmedEmail,
        p_name: trimmedName,
        p_phone: phone.trim() || null,
        p_source: "manual",
      });

      if (error) {
        if (error.message?.includes("duplicate") || error.code === "23505") {
          toast({ title: "Atenção", description: "Cliente já cadastrado com este e-mail.", variant: "destructive" });
        } else {
          throw error;
        }
        return;
      }

      // Save notes if provided
      if (notes.trim() && data) {
        await supabase
          .from("restaurant_customers")
          .update({ internal_notes: notes.trim() })
          .eq("id", data)
          .eq("restaurant_id", restaurantId);
      }

      toast({ title: "Sucesso", description: "Cliente cadastrado com sucesso!" });
      resetForm();
      onOpenChange(false);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao cadastrar cliente";
      toast({ title: "Erro", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            Cadastrar cliente
          </DialogTitle>
          <DialogDescription>
            Adicione um novo cliente manualmente ao seu restaurante.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="customer-name">Nome *</Label>
            <Input
              id="customer-name"
              placeholder="Nome do cliente"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-email">E-mail *</Label>
            <Input
              id="customer-email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={320}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-phone">Telefone</Label>
            <Input
              id="customer-phone"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={50}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="customer-notes">Observação</Label>
            <Textarea
              id="customer-notes"
              placeholder="Ex: cliente VIP, aniversário em março..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
