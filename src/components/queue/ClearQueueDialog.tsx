import { useState } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface ClearQueueDialogProps {
  onConfirm: () => Promise<unknown>;
  isLoading?: boolean;
  totalWaiting: number;
}

export function ClearQueueDialog({ onConfirm, isLoading, totalWaiting }: ClearQueueDialogProps) {
  const [open, setOpen] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleConfirm = async () => {
    setIsClearing(true);
    try {
      await onConfirm();
      setOpen(false);
    } finally {
      setIsClearing(false);
    }
  };

  // Habilitado sempre que não estiver carregando (permite limpar fila mesmo vazia)
  const isDisabled = isLoading;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="outline" 
          size="default"
          disabled={isDisabled}
          className="text-muted-foreground hover:text-destructive hover:border-destructive/50"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Limpar Fila
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Limpar Fila de Espera
          </AlertDialogTitle>
          <AlertDialogDescription className="text-base">
            Essa ação irá remover todos os <strong>{totalWaiting}</strong> clientes da fila atual. 
            <br />
            <span className="text-destructive font-medium">Essa ação não pode ser desfeita.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isClearing}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isClearing}
            className="bg-destructive hover:bg-destructive/90"
          >
            {isClearing ? "Limpando..." : "Confirmar limpeza"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
