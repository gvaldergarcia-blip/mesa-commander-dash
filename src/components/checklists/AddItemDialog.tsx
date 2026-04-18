import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useCreateItem } from '@/hooks/useChecklists';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categoryId: string;
  categoryName: string;
}

export function AddItemDialog({ open, onOpenChange, categoryId, categoryName }: Props) {
  const [name, setName] = useState('');
  const [critical, setCritical] = useState(false);
  const [photo, setPhoto] = useState(false);
  const create = useCreateItem();

  const handleSave = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({ category_id: categoryId, name: name.trim(), is_critical: critical, requires_photo: photo });
    setName(''); setCritical(false); setPhoto(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Novo item — {categoryName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome do item</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Verificar temperatura geladeira" />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Item crítico</Label>
              <p className="text-xs text-muted-foreground">Destaca como prioritário</p>
            </div>
            <Switch checked={critical} onCheckedChange={setCritical} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Exige foto</Label>
              <p className="text-xs text-muted-foreground">Equipe precisa enviar imagem</p>
            </div>
            <Switch checked={photo} onCheckedChange={setPhoto} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Salvando…' : 'Adicionar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
