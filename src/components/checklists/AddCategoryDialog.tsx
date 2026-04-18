import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateCategory } from '@/hooks/useChecklists';
import {
  ClipboardList, Sunrise, Moon, Sparkles, Thermometer, PackageCheck,
  Utensils, Coffee, Wine, Refrigerator, Brush, ShieldCheck, AlertTriangle, Truck,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICON_OPTIONS = [
  { name: 'ClipboardList', Icon: ClipboardList },
  { name: 'Sunrise', Icon: Sunrise },
  { name: 'Moon', Icon: Moon },
  { name: 'Sparkles', Icon: Sparkles },
  { name: 'Thermometer', Icon: Thermometer },
  { name: 'PackageCheck', Icon: PackageCheck },
  { name: 'Utensils', Icon: Utensils },
  { name: 'Coffee', Icon: Coffee },
  { name: 'Wine', Icon: Wine },
  { name: 'Refrigerator', Icon: Refrigerator },
  { name: 'Brush', Icon: Brush },
  { name: 'ShieldCheck', Icon: ShieldCheck },
  { name: 'AlertTriangle', Icon: AlertTriangle },
  { name: 'Truck', Icon: Truck },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddCategoryDialog({ open, onOpenChange }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('ClipboardList');
  const create = useCreateCategory();

  const handleSave = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), icon });
    setName('');
    setIcon('ClipboardList');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Categoria</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome da categoria</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Limpeza Banheiros" />
          </div>
          <div className="space-y-2">
            <Label>Ícone</Label>
            <div className="grid grid-cols-7 gap-2">
              {ICON_OPTIONS.map(({ name: n, Icon }) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setIcon(n)}
                  className={cn(
                    'h-10 w-10 rounded-md border flex items-center justify-center transition-colors',
                    icon === n ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                  )}
                  aria-label={n}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || create.isPending}>
            {create.isPending ? 'Salvando…' : 'Criar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
