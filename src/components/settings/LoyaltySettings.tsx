import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, Users, Star, Gift, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function LoyaltySettings() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            Programa Clique (Fidelidade)
          </CardTitle>
          <CardDescription>
            Entenda como funciona o programa de fidelidade do MesaClik
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* O que é */}
          <div className="space-y-3">
            <h3 className="font-semibold text-base">O que é o Clube MesaClik?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              O Clube MesaClik é o programa de fidelidade integrado ao seu restaurante. 
              Ele permite que seus clientes acumulem visitas e ganhem recompensas personalizadas, 
              incentivando o retorno e a fidelização.
            </p>
          </div>

          {/* Como funciona */}
          <div className="space-y-4">
            <h3 className="font-semibold text-base">Como funciona?</h3>
            <div className="grid gap-3">
              <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                <div className="p-2 rounded-full bg-primary/10 mt-0.5">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">1. Ativação individual</p>
                  <p className="text-xs text-muted-foreground">
                    O programa é ativado e configurado individualmente para cada cliente, 
                    diretamente no perfil do cliente em <strong>Clientes → Perfil → Clube MesaClik</strong>.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                <div className="p-2 rounded-full bg-primary/10 mt-0.5">
                  <Star className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">2. Acúmulo de visitas</p>
                  <p className="text-xs text-muted-foreground">
                    Cada vez que o cliente conclui uma fila ou reserva, uma visita é registrada automaticamente. 
                    Você também pode personalizar as visitas necessárias e a recompensa por cliente.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                <div className="p-2 rounded-full bg-primary/10 mt-0.5">
                  <Gift className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">3. Recompensa</p>
                  <p className="text-xs text-muted-foreground">
                    Ao atingir a meta de visitas, o cliente desbloqueia a recompensa configurada 
                    e recebe uma notificação automática por SMS e WhatsApp.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                <div className="p-2 rounded-full bg-primary/10 mt-0.5">
                  <ArrowRight className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">4. Acompanhamento pelo cliente</p>
                  <p className="text-xs text-muted-foreground">
                    O cliente recebe um link exclusivo para acompanhar seu progresso em tempo real, 
                    com a identidade visual do seu restaurante.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Onde configurar */}
          <div className="p-4 border rounded-lg bg-primary/5 border-primary/20">
            <p className="text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4 text-primary" />
              Onde ativar e configurar?
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Acesse <strong>Clientes</strong> → selecione um cliente → na seção <strong>Clube MesaClik</strong>, 
              ative o programa, defina visitas necessárias, recompensa e validade individualmente.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
