import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trophy, Gift, Target, AlertTriangle, Loader2 } from "lucide-react";
import { useLoyaltyProgram, type LoyaltyProgram, type CustomerLoyaltyStatus } from "@/hooks/useLoyaltyProgram";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  customerId: string;
  restaurantId: string;
  marketingOptIn?: boolean;
}

export function CustomerLoyaltyCard({ customerId, restaurantId, marketingOptIn = false }: Props) {
  const { fetchCustomerLoyalty } = useLoyaltyProgram(restaurantId);
  const { toast } = useToast();
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [status, setStatus] = useState<CustomerLoyaltyStatus | null>(null);
  const [loyaltyActive, setLoyaltyActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await fetchCustomerLoyalty(customerId);
      setProgram(result.program);
      setStatus(result.status);

      // Check if customer has loyalty_program_active
      const { data: custData } = await supabase
        .from("restaurant_customers")
        .select("loyalty_program_active")
        .eq("id", customerId)
        .maybeSingle();

      setLoyaltyActive((custData as any)?.loyalty_program_active || false);
      setLoading(false);
    };
    if (customerId && restaurantId) load();
  }, [customerId, restaurantId]);

  const handleToggle = async (enabled: boolean) => {
    if (!program) return;
    setToggling(true);
    try {
      const action = enabled ? "activate_customer" : "deactivate_customer";
      const { data, error } = await supabase.functions.invoke("loyalty-enroll", {
        body: { restaurant_id: restaurantId, action, customer_id: customerId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLoyaltyActive(enabled);

      if (enabled) {
        // Refresh status after activation
        const result = await fetchCustomerLoyalty(customerId);
        setStatus(result.status);
        toast({
          title: "✅ Programa ativado",
          description: data?.emailsSent > 0 ? "E-mail de ativação enviado ao cliente." : "Cliente inscrito no programa.",
        });
      } else {
        toast({
          title: "Programa desativado",
          description: "Cliente removido do programa de fidelidade.",
        });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  if (loading) return null;

  // Program not active globally
  if (!program) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-muted-foreground" />
            <CardTitle className="text-base">Programa Clique</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            O Programa Clique não está ativo neste restaurante.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Customer doesn't have marketing opt-in
  if (!marketingOptIn) {
    return (
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">{program.program_name}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 p-3 bg-warning/10 rounded-lg border border-warning/20">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0" />
            <p className="text-sm text-muted-foreground">
              Cliente não autorizou comunicações de marketing. Ative o opt-in para inscrever no programa.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentVisits = status?.current_visits || 0;
  const requiredVisits = program.required_visits;
  const pct = Math.min(100, (currentVisits / requiredVisits) * 100);
  const remaining = Math.max(0, requiredVisits - currentVisits);
  const rewardUnlocked = status?.reward_unlocked || false;
  const expired = status?.reward_expires_at && new Date(status.reward_expires_at) < new Date();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-primary" />
            <CardTitle className="text-base">{program.program_name}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {toggling && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            <Switch
              checked={loyaltyActive}
              onCheckedChange={handleToggle}
              disabled={toggling}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {!loyaltyActive ? (
          <p className="text-sm text-muted-foreground">
            Cliente ainda não participa do programa. Ative o toggle para inscrever.
          </p>
        ) : rewardUnlocked && !expired ? (
          <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg border border-success/20">
            <Gift className="w-5 h-5 text-success flex-shrink-0" />
            <div>
              <p className="font-semibold text-success text-sm">🏆 Recompensa disponível</p>
              <p className="text-xs text-muted-foreground">{program.reward_description}</p>
              {status?.reward_expires_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Válida até {new Date(status.reward_expires_at).toLocaleDateString("pt-BR")}
                </p>
              )}
            </div>
          </div>
        ) : expired ? (
          <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
            <Gift className="w-5 h-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Recompensa expirada</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">{currentVisits}/{requiredVisits} visitas</span>
              </div>
              <Badge variant="outline" className="text-xs">
                Faltam {remaining}
              </Badge>
            </div>
            <Progress value={pct} className="h-2.5" />
            <p className="text-xs text-muted-foreground">
              🎁 Meta: {program.reward_description}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
