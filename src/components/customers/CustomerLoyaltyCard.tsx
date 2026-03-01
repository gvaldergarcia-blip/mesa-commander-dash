import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Trophy, Gift, Target, AlertTriangle, Loader2, Settings, ChevronDown, ChevronUp, Save } from "lucide-react";
import { useLoyaltyProgram, type LoyaltyProgram, type CustomerLoyaltyStatus } from "@/hooks/useLoyaltyProgram";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  customerId: string;
  restaurantId: string;
  marketingOptIn?: boolean;
}

export function CustomerLoyaltyCard({ customerId, restaurantId, marketingOptIn = false }: Props) {
  const { fetchCustomerLoyalty, saveProgram, saving } = useLoyaltyProgram(restaurantId);
  const { toast } = useToast();
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [status, setStatus] = useState<CustomerLoyaltyStatus | null>(null);
  const [loyaltyActive, setLoyaltyActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  // Editable fields
  const [editVisits, setEditVisits] = useState(10);
  const [editReward, setEditReward] = useState("");
  const [editValidity, setEditValidity] = useState(30);
  const [editCountQueue, setEditCountQueue] = useState(true);
  const [editCountReservations, setEditCountReservations] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await fetchCustomerLoyalty(customerId);
      setProgram(result.program);
      setStatus(result.status);

      if (result.program) {
        setEditVisits(result.program.required_visits);
        setEditReward(result.program.reward_description);
        setEditValidity(result.program.reward_validity_days);
        setEditCountQueue(result.program.count_queue);
        setEditCountReservations(result.program.count_reservations);
      }

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

  const handleSaveConfig = async () => {
    if (!program) return;
    try {
      await saveProgram({
        is_active: program.is_active,
        program_name: program.program_name,
        required_visits: editVisits,
        count_queue: editCountQueue,
        count_reservations: editCountReservations,
        reward_description: editReward,
        reward_validity_days: editValidity,
      });
      // Refresh
      const result = await fetchCustomerLoyalty(customerId);
      setProgram(result.program);
      setStatus(result.status);
      setShowConfig(false);
    } catch {
      // toast already handled in hook
    }
  };

  if (loading) return null;

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
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs text-muted-foreground"
              onClick={() => setShowConfig(!showConfig)}
            >
              <Settings className="w-3.5 h-3.5" />
              Configurar
              {showConfig ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </Button>
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

        {/* Inline config panel */}
        {showConfig && (
          <>
            <Separator />
            <div className="space-y-3 pt-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Configurações do Programa</p>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Visitas necessárias</Label>
                  <Input
                    type="number"
                    min={2}
                    max={50}
                    value={editVisits}
                    onChange={(e) => setEditVisits(parseInt(e.target.value) || 10)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Validade (dias)</Label>
                  <Input
                    type="number"
                    min={7}
                    max={365}
                    value={editValidity}
                    onChange={(e) => setEditValidity(parseInt(e.target.value) || 30)}
                    className="mt-1 h-8 text-sm"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Descrição da recompensa</Label>
                <Textarea
                  value={editReward}
                  onChange={(e) => setEditReward(e.target.value)}
                  placeholder="Ex: 1 sobremesa grátis"
                  className="mt-1 text-sm min-h-[60px]"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs">O que conta como visita?</Label>
                <div className="flex items-center gap-3">
                  <Switch checked={editCountQueue} onCheckedChange={setEditCountQueue} id="cfg-queue" />
                  <Label htmlFor="cfg-queue" className="text-xs cursor-pointer">Fila concluída</Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={editCountReservations} onCheckedChange={setEditCountReservations} id="cfg-res" />
                  <Label htmlFor="cfg-res" className="text-xs cursor-pointer">Reserva concluída</Label>
                </div>
              </div>

              <Button onClick={handleSaveConfig} disabled={saving} size="sm" className="w-full gap-2">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Salvar Configurações
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
