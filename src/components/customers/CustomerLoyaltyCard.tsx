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
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Trophy, Gift, Target, AlertTriangle, Loader2, Settings, ChevronDown, ChevronUp, Save, Lock } from "lucide-react";
import { useLoyaltyProgram, type LoyaltyProgram, type CustomerLoyaltyStatus } from "@/hooks/useLoyaltyProgram";
import { supabase } from "@/lib/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Props {
  customerId: string;
  restaurantId: string;
  marketingOptIn?: boolean;
}

export function CustomerLoyaltyCard({ customerId, restaurantId, marketingOptIn = false }: Props) {
  const { fetchCustomerLoyalty, saving } = useLoyaltyProgram(restaurantId);
  const { toast } = useToast();
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [status, setStatus] = useState<CustomerLoyaltyStatus | null>(null);
  const [loyaltyActive, setLoyaltyActive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Per-customer editable fields
  const [editVisits, setEditVisits] = useState(10);
  const [editReward, setEditReward] = useState("");
  const [editValidity, setEditValidity] = useState(30);
  const [savingCustomConfig, setSavingCustomConfig] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await fetchCustomerLoyalty(customerId);
      setProgram(result.program);
      setStatus(result.status);

      // Load per-customer overrides or fall back to program defaults
      if (result.status) {
        const s = result.status as any;
        setEditVisits(s.custom_required_visits ?? result.program?.required_visits ?? 10);
        setEditReward(s.custom_reward_description ?? result.program?.reward_description ?? "");
        setEditValidity(s.custom_reward_validity_days ?? result.program?.reward_validity_days ?? 30);
      } else if (result.program) {
        setEditVisits(result.program.required_visits);
        setEditReward(result.program.reward_description);
        setEditValidity(result.program.reward_validity_days);
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

  const handleToggleAttempt = (enabled: boolean) => {
    if (!enabled && loyaltyActive) {
      // Block disabling
      toast({
        title: "⚠️ Ação bloqueada",
        description: "Uma vez habilitado, o programa de fidelidade não pode ser desativado para este cliente.",
        variant: "destructive",
      });
      return;
    }
    if (enabled) {
      setShowConfirmDialog(true);
    }
  };

  const handleConfirmActivation = async () => {
    setShowConfirmDialog(false);
    if (!program) return;
    setToggling(true);
    try {
      const { data, error } = await supabase.functions.invoke("loyalty-enroll", {
        body: { restaurant_id: restaurantId, action: "activate_customer", customer_id: customerId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setLoyaltyActive(true);

      const result = await fetchCustomerLoyalty(customerId);
      setStatus(result.status);

      toast({
        title: "✅ Programa ativado",
        description: data?.emailsSent > 0
          ? "E-mail de ativação enviado ao cliente."
          : "Cliente inscrito no programa.",
      });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setToggling(false);
    }
  };

  const handleSaveCustomConfig = async () => {
    if (!status) return;
    setSavingCustomConfig(true);
    try {
      const { error } = await supabase
        .from("customer_loyalty_status" as any)
        .update({
          custom_required_visits: editVisits,
          custom_reward_description: editReward,
          custom_reward_validity_days: editValidity,
        } as any)
        .eq("restaurant_id", restaurantId)
        .eq("customer_id", customerId);

      if (error) throw error;

      // Refresh
      const result = await fetchCustomerLoyalty(customerId);
      setProgram(result.program);
      setStatus(result.status);
      setShowConfig(false);

      toast({ title: "✅ Configuração salva", description: "Configuração personalizada deste cliente atualizada." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSavingCustomConfig(false);
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

  // Use per-customer overrides if available
  const statusAny = status as any;
  const effectiveRequiredVisits = statusAny?.custom_required_visits ?? program.required_visits;
  const effectiveRewardDescription = statusAny?.custom_reward_description ?? program.reward_description;

  const currentVisits = status?.current_visits || 0;
  const pct = Math.min(100, (currentVisits / effectiveRequiredVisits) * 100);
  const remaining = Math.max(0, effectiveRequiredVisits - currentVisits);
  const rewardUnlocked = status?.reward_unlocked || false;
  const expired = status?.reward_expires_at && new Date(status.reward_expires_at) < new Date();

  return (
    <>
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">{program.program_name}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              {loyaltyActive && (
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
              )}
              {toggling && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              {loyaltyActive ? (
                <div className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  <Switch
                    checked={true}
                    onCheckedChange={handleToggleAttempt}
                    disabled={toggling}
                  />
                </div>
              ) : (
                <Switch
                  checked={false}
                  onCheckedChange={handleToggleAttempt}
                  disabled={toggling}
                />
              )}
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
                <p className="text-xs text-muted-foreground">{effectiveRewardDescription}</p>
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
                  <span className="text-sm font-medium">{currentVisits}/{effectiveRequiredVisits} visitas</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  Faltam {remaining}
                </Badge>
              </div>
              <Progress value={pct} className="h-2.5" />
              <p className="text-xs text-muted-foreground">
                🎁 Meta: {effectiveRewardDescription}
              </p>
            </>
          )}

          {/* Per-customer config panel */}
          {showConfig && loyaltyActive && (
            <>
              <Separator />
              <div className="space-y-3 pt-1">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Configurações deste cliente
                  </p>
                  <Badge variant="secondary" className="text-[10px]">Individual</Badge>
                </div>

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

                <Button onClick={handleSaveCustomConfig} disabled={savingCustomConfig} size="sm" className="w-full gap-2">
                  {savingCustomConfig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Salvar para este cliente
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Confirmation dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Ativar Programa de Fidelidade
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Ao ativar o programa para este cliente, <strong>não será possível desativá-lo posteriormente</strong>.
              </p>
              <p>
                O cliente receberá um e-mail de boas-vindas e será notificado por e-mail conforme se aproximar da meta de visitas.
              </p>
              <p className="text-sm font-medium">Deseja continuar?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmActivation}>
              Sim, ativar programa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
