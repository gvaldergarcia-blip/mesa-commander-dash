import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Trophy, Gift, Target } from "lucide-react";
import { useLoyaltyProgram, type LoyaltyProgram, type CustomerLoyaltyStatus } from "@/hooks/useLoyaltyProgram";

interface Props {
  customerId: string;
  restaurantId: string;
}

export function CustomerLoyaltyCard({ customerId, restaurantId }: Props) {
  const { fetchCustomerLoyalty } = useLoyaltyProgram(restaurantId);
  const [program, setProgram] = useState<LoyaltyProgram | null>(null);
  const [status, setStatus] = useState<CustomerLoyaltyStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await fetchCustomerLoyalty(customerId);
      setProgram(result.program);
      setStatus(result.status);
      setLoading(false);
    };
    if (customerId && restaurantId) load();
  }, [customerId, restaurantId]);

  if (loading || !program) return null;

  const currentVisits = status?.current_visits || 0;
  const requiredVisits = program.required_visits;
  const pct = Math.min(100, (currentVisits / requiredVisits) * 100);
  const remaining = Math.max(0, requiredVisits - currentVisits);
  const rewardUnlocked = status?.reward_unlocked || false;
  const expired = status?.reward_expires_at && new Date(status.reward_expires_at) < new Date();

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          <CardTitle className="text-base">{program.program_name}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {rewardUnlocked && !expired ? (
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
