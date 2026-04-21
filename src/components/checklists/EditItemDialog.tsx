import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useUpdateItem, ChecklistItem } from '@/hooks/useChecklists';
import { WeekdaysSelector, ALL_DAYS } from './WeekdaysSelector';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: ChecklistItem | null;
}

export function EditItemDialog({ open, onOpenChange, item }: Props) {
  const [name, setName] = useState('');
  const [critical, setCritical] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [hasQr, setHasQr] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [activeDays, setActiveDays] = useState<number[]>(ALL_DAYS);
  const update = useUpdateItem();

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCritical(item.is_critical);
      setPhoto(item.requires_photo);
      setHasQr(item.has_qr);
      setScheduledTime(item.scheduled_time ?? '');
      setActiveDays(item.active_days?.length ? item.active_days : ALL_DAYS);
    }
  }, [item]);

  const handleSave = async () => {
    if (!item || !name.trim()) return;
    await update.mutateAsync({
      id: item.id,
      name: name.trim(),
      is_critical: critical,
      requires_photo: photo,
      has_qr: hasQr,
      scheduled_time: scheduledTime || null,
      active_days: activeDays.length > 0 ? activeDays : ALL_DAYS,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nome do item</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Horário previsto (opcional)</Label>
            <Input
              type="time"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="dark:[&::-webkit-calendar-picker-indicator]:invert"
            />
          </div>
          <div className="space-y-2">
            <Label>Repetir nos dias:</Label>
            <WeekdaysSelector value={activeDays} onChange={setActiveDays} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">É crítico</Label>
              <p className="text-xs text-muted-foreground">Destaca como prioritário</p>
            </div>
            <Switch checked={critical} onCheckedChange={setCritical} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Exige foto como evidência</Label>
              <p className="text-xs text-muted-foreground">Equipe precisa enviar imagem</p>
            </div>
            <Switch checked={photo} onCheckedChange={setPhoto} />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="text-sm">Validação por QR Code</Label>
              <p className="text-xs text-muted-foreground">Equipe escaneia QR físico para concluir</p>
            </div>
            <Switch checked={hasQr} onCheckedChange={setHasQr} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!name.trim() || update.isPending}>
            {update.isPending ? 'Salvando…' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}