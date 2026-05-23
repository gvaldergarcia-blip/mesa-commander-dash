import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Users, Loader2 } from "lucide-react";
import { LabelEmployee, useLabelEmployees } from "@/hooks/useLabelEmployees";
import { EmployeeFormDialog } from "./EmployeeFormDialog";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function EmployeesManager() {
  const { employees, isLoading, create, update, remove, isMutating } = useLabelEmployees();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<LabelEmployee | null>(null);
  const [delTarget, setDelTarget] = useState<LabelEmployee | null>(null);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Funcionários</h2>
          <p className="text-sm text-muted-foreground">Cadastre quem imprime e dá baixa nas etiquetas.</p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Funcionário
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : employees.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border/50 rounded-2xl text-muted-foreground">
          <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Nenhum funcionário cadastrado</p>
          <p className="text-sm mt-1">Cadastre para começar a imprimir etiquetas.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {employees.map((e) => (
            <Card key={e.id} className="p-4 bg-card/40 border-border/50 flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-lg">
                {e.name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{e.name}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="truncate">{e.role || "—"}</span>
                  {e.status === "inactive" && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDelTarget(e)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <EmployeeFormDialog
        open={open}
        onOpenChange={setOpen}
        employee={editing}
        isSubmitting={isMutating}
        onSubmit={async (input) => {
          if (editing) await update({ id: editing.id, input });
          else await create(input);
        }}
      />

      <AlertDialog open={!!delTarget} onOpenChange={(o) => !o && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover funcionário</AlertDialogTitle>
            <AlertDialogDescription>Remover {delTarget?.name}? Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => { if (delTarget) await remove(delTarget.id); setDelTarget(null); }}
            >Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}