import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

type QueueAlertProps = {
  totalWaiting: number;
  capacityLimit: number;
};

/**
 * Alerta visual quando a fila está cheia
 * Exibe banner superior quando grupos >= capacityLimit
 */
export function QueueAlert({ totalWaiting, capacityLimit }: QueueAlertProps) {
  if (totalWaiting < capacityLimit) return null;

  // Crítico: >= capacityLimit
  const isCritical = totalWaiting >= capacityLimit;

  return (
    <Alert variant={isCritical ? "destructive" : "default"} className="border-2">
      <AlertTriangle className="h-5 w-5" />
      <AlertTitle className="font-bold">
        {isCritical ? "Atenção: Fila Cheia!" : "Fila em Capacidade Máxima"}
      </AlertTitle>
      <AlertDescription>
        A fila está com {totalWaiting} grupos aguardando. Considere aumentar a capacidade ou 
        avisar os clientes sobre o tempo de espera estimado.
      </AlertDescription>
    </Alert>
  );
}
