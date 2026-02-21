import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trophy, Gift, Target, Users, Loader2, Save, CheckCircle2 } from "lucide-react";
import { useLoyaltyProgram } from "@/hooks/useLoyaltyProgram";
import { cn } from "@/lib/utils";

interface Props {
  restaurantId: string;
}

export function LoyaltySettings({ restaurantId }: Props) {
  const { program, statuses, loading, saving, saveProgram, resetCustomer } = useLoyaltyProgram(restaurantId);

  const [isActive, setIsActive] = useState(false);
  const [programName, setProgramName] = useState("Clube MesaClik");
  const [requiredVisits, setRequiredVisits] = useState(10);
  const [countQueue, setCountQueue] = useState(true);
  const [countReservations, setCountReservations] = useState(true);
  const [rewardDescription, setRewardDescription] = useState("");
  const [rewardValidityDays, setRewardValidityDays] = useState(30);

  useEffect(() => {
    if (program) {
      setIsActive(program.is_active);
      setProgramName(program.program_name);
      setRequiredVisits(program.required_visits);
      setCountQueue(program.count_queue);
      setCountReservations(program.count_reservations);
      setRewardDescription(program.reward_description);
      setRewardValidityDays(program.reward_validity_days);
    }
  }, [program]);

  const handleSave = async () => {
    await saveProgram({
      is_active: isActive,
      program_name: programName,
      required_visits: requiredVisits,
      count_queue: countQueue,
      count_reservations: countReservations,
      reward_description: rewardDescription,
      reward_validity_days: rewardValidityDays,
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Programa Clique (Fidelidade)
          </CardTitle>
          <CardDescription>
            Configure o programa de fidelidade automático. Clientes acumulam visitas e ganham recompensas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle ativar */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
            <div>
              <p className="font-medium">Ativar Programa Clique</p>
              <p className="text-sm text-muted-foreground">
                Quando ativo, todos os clientes elegíveis entram automaticamente
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <Separator />

          {/* Configurações */}
          <div className="space-y-4">
            <div>
              <Label>Nome do Programa</Label>
              <Input
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="Ex: Clube MesaClik"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Visitas necessárias para recompensa</Label>
              <Input
                type="number"
                min={2}
                max={50}
                value={requiredVisits}
                onChange={(e) => setRequiredVisits(parseInt(e.target.value) || 10)}
                className="mt-1.5 w-32"
              />
            </div>

            <div className="space-y-3">
              <Label>O que conta como visita?</Label>
              <div className="flex items-center gap-3">
                <Switch checked={countQueue} onCheckedChange={setCountQueue} id="count-queue" />
                <Label htmlFor="count-queue" className="cursor-pointer">Fila concluída</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={countReservations} onCheckedChange={setCountReservations} id="count-res" />
                <Label htmlFor="count-res" className="cursor-pointer">Reserva concluída</Label>
              </div>
            </div>

            <Separator />

            <div>
              <Label>Descrição da recompensa</Label>
              <Textarea
                value={rewardDescription}
                onChange={(e) => setRewardDescription(e.target.value)}
                placeholder="Ex: 1 sobremesa grátis na próxima visita"
                className="mt-1.5"
              />
            </div>

            <div>
              <Label>Validade da recompensa (dias)</Label>
              <Input
                type="number"
                min={7}
                max={365}
                value={rewardValidityDays}
                onChange={(e) => setRewardValidityDays(parseInt(e.target.value) || 30)}
                className="mt-1.5 w-32"
              />
            </div>
          </div>

          <Separator />

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Programa
          </Button>
        </CardContent>
      </Card>

      {/* Status dos clientes */}
      {isActive && statuses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5 text-primary" />
              Progresso dos Clientes
              <Badge variant="secondary" className="ml-auto">{statuses.length} inscritos</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {statuses.slice(0, 50).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "p-1.5 rounded-full",
                      s.reward_unlocked ? "bg-success/10" : "bg-muted"
                    )}>
                      {s.reward_unlocked ? (
                        <Gift className="h-4 w-4 text-success" />
                      ) : (
                        <Target className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{s.customer_name || 'Cliente'}</p>
                      <p className="text-xs text-muted-foreground">{s.customer_email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={s.reward_unlocked ? "default" : "secondary"} className="text-xs">
                      {s.current_visits}/{requiredVisits}
                    </Badge>
                    {s.reward_unlocked && (
                      <Badge className="bg-success/15 text-success border-success/30 text-xs">
                        <CheckCircle2 className="h-3 w-3 mr-1" /> Recompensa
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => resetCustomer(s.customer_id)}
                    >
                      Resetar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
