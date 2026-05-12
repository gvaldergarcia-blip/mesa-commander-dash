import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Upload, X } from 'lucide-react';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { MenuDish, DishCategory, DishMargin, useMenuDishes, uploadDishPhoto } from '@/hooks/useMenuDishes';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES: { v: DishCategory; label: string }[] = [
  { v: 'entrada', label: 'Entrada' },
  { v: 'principal', label: 'Prato Principal' },
  { v: 'sobremesa', label: 'Sobremesa' },
  { v: 'bebida', label: 'Bebida' },
  { v: 'especial', label: 'Especial do Chef' },
];
const PROFILES = ['Família com crianças', 'Casal romântico', 'Executivos / Almoço corporativo', 'Grupo de amigos', 'Cliente VIP', 'Qualquer perfil'];
const OCCASIONS = ['Almoço', 'Jantar', 'Fim de semana', 'Feriado', 'Qualquer hora'];
const RESTRICTIONS = ['Vegetariano', 'Vegano', 'Sem glúten', 'Sem lactose', 'Sem frutos do mar', 'Sem carne vermelha', 'Halal'];
const MARGINS: { v: DishMargin; label: string }[] = [
  { v: 'alta', label: 'Alta' }, { v: 'media', label: 'Média' }, { v: 'baixa', label: 'Baixa' },
];

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  dish: MenuDish | null;
}

export function DishFormDialog({ open, onOpenChange, dish }: Props) {
  const { restaurantId } = useRestaurant();
  const { create, update } = useMenuDishes();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<DishCategory>('principal');
  const [ingredients, setIngredients] = useState<string[]>([]);
  const [ingInput, setIngInput] = useState('');
  const [profiles, setProfiles] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [margin, setMargin] = useState<DishMargin>('media');
  const [restrictions, setRestrictions] = useState<string[]>([]);
  const [aiNotes, setAiNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (open) {
      setName(dish?.name ?? '');
      setDescription(dish?.description ?? '');
      setPrice(dish?.price?.toString() ?? '');
      setCategory((dish?.category as DishCategory) ?? 'principal');
      setIngredients(dish?.ingredients ?? []);
      setProfiles(dish?.profiles ?? []);
      setOccasions(dish?.occasions ?? []);
      setMargin((dish?.margin as DishMargin) ?? 'media');
      setRestrictions(dish?.restrictions ?? []);
      setAiNotes(dish?.ai_notes ?? '');
      setPhotoUrl(dish?.photo_url ?? null);
      setIngInput('');
    }
  }, [open, dish]);

  const toggle = (arr: string[], setArr: (s: string[]) => void, value: string) => {
    setArr(arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]);
  };

  const addIng = () => {
    const v = ingInput.trim();
    if (!v) return;
    if (!ingredients.includes(v)) setIngredients([...ingredients, v]);
    setIngInput('');
  };

  const handleFile = async (file: File | undefined) => {
    if (!file || !restaurantId) return;
    try {
      setUploading(true);
      const url = await uploadDishPhoto(file, restaurantId);
      setPhotoUrl(url);
    } catch (e: any) {
      toast.error(e.message ?? 'Falha no upload da foto');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Informe o nome do prato'); return; }
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      price: price ? parseFloat(price.replace(',', '.')) : null,
      category,
      ingredients,
      profiles,
      occasions,
      margin,
      restrictions,
      ai_notes: aiNotes.trim() || null,
      photo_url: photoUrl,
    };
    if (dish) await update.mutateAsync({ id: dish.id, ...payload });
    else await create.mutateAsync(payload as any);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{dish ? 'Editar prato' : 'Adicionar prato'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Foto */}
          <div className="space-y-2">
            <Label>Foto do prato</Label>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault(); setDragOver(false);
                handleFile(e.dataTransfer.files?.[0]);
              }}
              className={cn(
                'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors',
                dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              )}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])} />
              {uploading ? (
                <div className="flex items-center justify-center py-6 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" /> Enviando foto…
                </div>
              ) : photoUrl ? (
                <div className="relative inline-block">
                  <img src={photoUrl} alt="Prato" className="rounded-[10px] max-h-44 object-cover" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setPhotoUrl(null); }}
                    className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                    aria-label="Remover foto"
                  ><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <div className="py-6 text-muted-foreground text-sm">
                  <Upload className="h-6 w-6 mx-auto mb-2 opacity-60" />
                  Arraste a foto do prato aqui ou clique para selecionar
                </div>
              )}
            </div>
          </div>

          {/* Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do prato *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Moqueca de Camarão" />
            </div>
            <div className="space-y-2">
              <Label>Preço (R$)</Label>
              <Input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0,00" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição curta</Label>
            <Input value={description} maxLength={120} onChange={(e) => setDescription(e.target.value)}
              placeholder="Máx. 120 caracteres" />
            <p className="text-xs text-muted-foreground text-right">{description.length}/120</p>
          </div>

          <div className="space-y-2">
            <Label>Categoria</Label>
            <select value={category} onChange={(e) => setCategory(e.target.value as DishCategory)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.label}</option>)}
            </select>
          </div>

          {/* Ingredientes */}
          <div className="space-y-2">
            <Label>Ingredientes principais</Label>
            <div className="flex gap-2">
              <Input
                value={ingInput}
                onChange={(e) => setIngInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addIng(); } }}
                placeholder="Digite e tecle Enter (ex: camarão)"
              />
              <Button type="button" variant="outline" onClick={addIng}>Adicionar</Button>
            </div>
            {ingredients.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {ingredients.map((i) => (
                  <Badge key={i} variant="secondary" className="gap-1">
                    {i}
                    <button onClick={() => setIngredients(ingredients.filter((x) => x !== i))}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Perfis */}
          <div className="space-y-2">
            <Label>Perfil do cliente ideal</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PROFILES.map((p) => (
                <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={profiles.includes(p)} onCheckedChange={() => toggle(profiles, setProfiles, p)} />
                  {p}
                </label>
              ))}
            </div>
          </div>

          {/* Ocasiões */}
          <div className="space-y-2">
            <Label>Melhor ocasião</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {OCCASIONS.map((o) => (
                <label key={o} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={occasions.includes(o)} onCheckedChange={() => toggle(occasions, setOccasions, o)} />
                  {o}
                </label>
              ))}
            </div>
          </div>

          {/* Margem */}
          <div className="space-y-2">
            <Label>Margem de lucro</Label>
            <div className="flex gap-2">
              {MARGINS.map((m) => (
                <Button key={m.v} type="button"
                  variant={margin === m.v ? 'default' : 'outline'}
                  size="sm" onClick={() => setMargin(m.v)}>{m.label}</Button>
              ))}
            </div>
          </div>

          {/* Restrições */}
          <div className="space-y-2">
            <Label>Restrições alimentares</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {RESTRICTIONS.map((r) => (
                <label key={r} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox checked={restrictions.includes(r)} onCheckedChange={() => toggle(restrictions, setRestrictions, r)} />
                  {r}
                </label>
              ))}
            </div>
          </div>

          {/* IA */}
          <div className="space-y-2">
            <Label>Observações para a IA (opcional)</Label>
            <Textarea value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} rows={3}
              placeholder="Ex: prato mais pedido nas sextas, ideal para datas especiais, especialidade da casa..." />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending || uploading}>
            {create.isPending || update.isPending ? 'Salvando…' : 'Salvar Prato'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}