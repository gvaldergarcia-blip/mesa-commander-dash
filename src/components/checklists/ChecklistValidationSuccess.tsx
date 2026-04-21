import { CheckCircle2 } from 'lucide-react';

interface ChecklistValidationSuccessProps {
  itemName: string;
}

export function ChecklistValidationSuccess({ itemName }: ChecklistValidationSuccessProps) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-success text-success-foreground px-6 text-center">
      <div className="rounded-full border-4 border-success-foreground/30 p-6 mb-6 animate-in zoom-in-75 duration-300">
        <CheckCircle2 className="h-28 w-28" strokeWidth={1.8} />
      </div>
      <h2 className="text-3xl font-bold">Atividade validada</h2>
      <p className="mt-3 max-w-sm text-lg font-medium text-success-foreground/90">{itemName}</p>
    </div>
  );
}