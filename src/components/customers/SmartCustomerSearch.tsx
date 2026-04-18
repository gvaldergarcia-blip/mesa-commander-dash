import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, Loader2, CheckCircle2, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useToast } from "@/hooks/use-toast";
import { CreateCustomerSmartDialog } from "./CreateCustomerSmartDialog";

type SearchResult = {
  id: string;
  customer_name: string | null;
  customer_email: string;
  customer_phone: string | null;
  total_visits: number;
};

type Props = {
  onCustomerRegistered?: () => void;
};

export function SmartCustomerSearch({ onCustomerRegistered }: Props) {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [registering, setRegistering] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const isPhoneQuery = /\d/.test(query);
  const trimmed = query.trim();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!trimmed || !restaurantId || trimmed.length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const phoneDigits = trimmed.replace(/\D/g, "");
        let queryBuilder = supabase
          .from("restaurant_customers")
          .select("id, customer_name, customer_email, customer_phone, total_visits")
          .eq("restaurant_id", restaurantId)
          .limit(8);

        if (phoneDigits.length >= 2 && phoneDigits.length === trimmed.replace(/\s|\(|\)|-/g, "").length) {
          queryBuilder = queryBuilder.ilike("customer_phone", `%${phoneDigits}%`);
        } else {
          queryBuilder = queryBuilder.or(
            `customer_name.ilike.%${trimmed}%,customer_phone.ilike.%${phoneDigits || trimmed}%`
          );
        }

        const { data, error } = await queryBuilder;
        if (error) throw error;
        setResults((data as SearchResult[]) || []);
        setHasSearched(true);
      } catch (err) {
        console.error("Smart search error:", err);
        setResults([]);
        setHasSearched(true);
      } finally {
        setSearching(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [trimmed, restaurantId]);

  const handleRegisterVisit = async (customer: SearchResult) => {
    if (!restaurantId) return;
    setRegistering(customer.id);
    try {
      const { error } = await supabase.rpc("register_customer_visit", {
        p_restaurant_id: restaurantId,
        p_email: customer.customer_email,
        p_name: customer.customer_name || "Cliente",
        p_phone: customer.customer_phone,
        p_source: "registro_manual",
        p_notes: "Visita registrada via busca inteligente",
      });

      if (error) throw error;

      // Trigger loyalty check
      try {
        await supabase.functions.invoke("loyalty-enroll", {
          body: {
            restaurant_id: restaurantId,
            action: "check_reward",
            customer_id: customer.id,
          },
        });
      } catch (e) {
        console.warn("Loyalty check failed:", e);
      }

      toast({
        title: "Visita registrada com sucesso ✓",
        description: `Visita de ${customer.customer_name || "cliente"} registrada.`,
      });
      onCustomerRegistered?.();
      navigate(`/customers/${customer.id}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao registrar visita";
      toast({ title: "Erro", description: msg, variant: "destructive" });
    } finally {
      setRegistering(null);
    }
  };

  const showNoResults = hasSearched && !searching && results.length === 0 && trimmed.length >= 2;

  return (
    <>
      <Card className="p-4 border-primary/20 bg-gradient-to-br from-background to-primary/5">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Search className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm">Busca rápida de cliente</h3>
              <p className="text-xs text-muted-foreground">
                Digite e identifique automaticamente se o cliente já existe
              </p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              autoFocus={false}
              placeholder="Buscar cliente por nome ou telefone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 h-11 text-base"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>

          {results.length > 0 && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
              <p className="text-xs text-muted-foreground px-1">
                {results.length} cliente(s) encontrado(s) — clique para registrar visita:
              </p>
              {results.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => handleRegisterVisit(customer)}
                  disabled={registering === customer.id}
                  className="w-full text-left p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary transition flex items-center justify-between gap-3 disabled:opacity-50"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm shrink-0">
                      {(customer.customer_name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">
                        {customer.customer_name || "Sem nome"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {customer.customer_phone || customer.customer_email}
                        {" • "}
                        <span className="font-medium text-primary">
                          {customer.total_visits} visita{customer.total_visits !== 1 ? "s" : ""}
                        </span>
                      </p>
                    </div>
                  </div>
                  {registering === customer.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {showNoResults && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
              <div className="p-3 rounded-lg border border-dashed bg-muted/30 text-center">
                <User className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-sm font-medium">Nenhum cliente encontrado</p>
                <p className="text-xs text-muted-foreground">
                  Cadastre "{trimmed}" como novo cliente
                </p>
              </div>
              <Button
                onClick={() => setDialogOpen(true)}
                className="w-full bg-primary hover:bg-primary/90"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Cadastrar novo cliente
              </Button>
            </div>
          )}
        </div>
      </Card>

      <CreateCustomerSmartDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prefillName={isPhoneQuery ? "" : trimmed}
        prefillPhone={isPhoneQuery ? trimmed : ""}
        onSuccess={(customerId) => {
          setQuery("");
          setResults([]);
          setHasSearched(false);
          onCustomerRegistered?.();
          if (customerId) navigate(`/customers/${customerId}`);
        }}
      />
    </>
  );
}
