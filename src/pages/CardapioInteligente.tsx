import { useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ChefHat, Plus, Pencil, Sparkles, Trash2, TrendingUp, Cake, AlertTriangle,
  CalendarDays, ImageOff, Loader2,
} from 'lucide-react';
import { MenuDish, useMenuDishes, DishCategory, DishMargin } from '@/hooks/useMenuDishes';
import { DishFormDialog } from '@/components/cardapio/DishFormDialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { useQueryClient } from '@tanstack/react-query';
import { Wand2 } from 'lucide-react';

const CATEGORY_LABEL: Record<DishCategory, string> = {
  entrada: 'Entrada', principal: 'Prato Principal', sobremesa: 'Sobremesa',
  bebida: 'Bebida', especial: 'Especial do Chef',
};
const CATEGORY_COLOR: Record<DishCategory, string> = {
  entrada: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
  principal: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  sobremesa: 'bg-purple-500/15 text-purple-600 border-purple-500/30',
  bebida: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30',
  especial: 'bg-pink-500/15 text-pink-600 border-pink-500/30',
};
const MARGIN_COLOR: Record<DishMargin, string> = {
  alta: 'text-green-600', media: 'text-yellow-600', baixa: 'text-red-500',
};
const MARGIN_LABEL: Record<DishMargin, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };

const fmtBRL = (n: number | null) =>
  n == null ? '—' : n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function CardapioInteligente() {
  const { dishes, isLoading, remove } = useMenuDishes();
  const { restaurantId } = useRestaurant();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pratos' | 'insights'>('pratos');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MenuDish | null>(null);
  const [campaignDish, setCampaignDish] = useState<MenuDish | null>(null);
  const [campaignSituation, setCampaignSituation] = useState<string>('');
  const [importing, setImporting] = useState(false);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit = (d: MenuDish) => { setEditing(d); setFormOpen(true); };

  const handleImportFromMenu = async () => {
    if (!restaurantId) return;
    setImporting(true);
    const t = toast.loading('IA analisando seu cardápio…', { description: 'Isso pode levar até 1 minuto.' });
    try {
      const { data, error } = await supabase.functions.invoke('import-menu-ai', {
        body: { restaurantId },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const count = (data as any)?.count ?? 0;
      const skipped = (data as any)?.skipped ?? 0;
      toast.success(`${count} prato(s) importado(s)`, {
        id: t,
        description: skipped > 0 ? `${skipped} já existiam e foram ignorados.` : 'Agora é só anexar as fotos de cada prato.',
      });
      qc.invalidateQueries({ queryKey: ['menu-dishes'] });
    } catch (e: any) {
      toast.error('Não foi possível importar o cardápio', {
        id: t,
        description: e?.message ?? 'Verifique se o cardápio está anexado em Configurações.',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-3 md:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            Cardápio Inteligente
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            A IA aprende seus pratos e personaliza campanhas para cada cliente.
          </p>
        </div>
        <div className="flex gap-2 self-start flex-wrap">
          <Button
            variant="outline"
            onClick={handleImportFromMenu}
            disabled={importing}
            title="A IA lê o cardápio anexado nas Configurações e importa os pratos automaticamente"
          >
            {importing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Wand2 className="mr-1 h-4 w-4" />}
            Importar do Cardápio (IA)
          </Button>
          <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            <Plus className="mr-1 h-4 w-4" /> Adicionar Prato
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
        <TabsList className="grid grid-cols-2 w-full md:w-auto md:inline-flex">
          <TabsTrigger value="pratos">Pratos</TabsTrigger>
          <TabsTrigger value="insights">
            <Sparkles className="mr-1 h-4 w-4" /> Insights da IA
          </TabsTrigger>
        </TabsList>

        {/* ============ PRATOS ============ */}
        <TabsContent value="pratos" className="space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : dishes.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center text-muted-foreground">
                <ChefHat className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Seu cardápio está vazio</p>
                <p className="text-sm mt-1">
                  Clique em <strong>"Importar do Cardápio (IA)"</strong> para a IA ler o cardápio anexado em Configurações,
                  ou em <strong>"Adicionar Prato"</strong> para cadastrar manualmente.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dishes.map((d) => (
                <DishCard key={d.id} dish={d} onEdit={() => openEdit(d)} onDelete={() => remove.mutate(d.id)} />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============ INSIGHTS ============ */}
        <TabsContent value="insights" className="space-y-6">
          <InsightsTab dishes={dishes}
            onCreateCampaign={(d, s) => { setCampaignDish(d); setCampaignSituation(s); }}
          />
        </TabsContent>
      </Tabs>

      <DishFormDialog open={formOpen} onOpenChange={setFormOpen} dish={editing} />
      <CampaignDialog
        open={!!campaignDish}
        onOpenChange={(o) => !o && setCampaignDish(null)}
        dish={campaignDish}
        situation={campaignSituation}
      />
    </div>
  );
}

/* ============ Card de Prato ============ */
function DishCard({ dish, onEdit, onDelete }: { dish: MenuDish; onEdit: () => void; onDelete: () => void }) {
  const cat = (dish.category as DishCategory) ?? 'principal';
  const occ = dish.occasions[0] ?? 'Qualquer hora';
  const profile = dish.profiles[0] ?? 'Qualquer perfil';
  return (
    <Card className="overflow-hidden border hover:border-primary transition-all duration-200 animate-in fade-in slide-in-from-bottom-2">
      <div className="aspect-video bg-muted relative">
        {dish.photo_url ? (
          <img src={dish.photo_url} alt={dish.name} className="w-full h-full object-cover" style={{ borderRadius: '10px 10px 0 0' }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="h-8 w-8 opacity-40" />
          </div>
        )}
        <Badge className={cn('absolute top-2 left-2 border', CATEGORY_COLOR[cat])}>
          {CATEGORY_LABEL[cat]}
        </Badge>
      </div>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-bold truncate">{dish.name}</h3>
          <span className="font-semibold text-primary whitespace-nowrap">{fmtBRL(dish.price)}</span>
        </div>
        {dish.description && <p className="text-xs text-muted-foreground line-clamp-2">{dish.description}</p>}
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline" className="text-[10px]"><CalendarDays className="h-3 w-3 mr-1" />{occ}</Badge>
          <Badge variant="outline" className="text-[10px]">{profile}</Badge>
          <Badge variant="outline" className={cn('text-[10px]', MARGIN_COLOR[dish.margin as DishMargin])}>
            <TrendingUp className="h-3 w-3 mr-1" /> Margem {MARGIN_LABEL[dish.margin as DishMargin]}
          </Badge>
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={() => toast.info('Insights individuais em breve')}>
            <Sparkles className="h-3.5 w-3.5 mr-1" /> Insights
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} aria-label="Remover">
            <Trash2 className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============ Aba Insights ============ */
function InsightsTab({
  dishes, onCreateCampaign,
}: { dishes: MenuDish[]; onCreateCampaign: (d: MenuDish, situation: string) => void }) {
  const highMargin = useMemo(() => dishes.find((d) => d.margin === 'alta'), [dishes]);
  const family = useMemo(() => dishes.find((d) => d.profiles.some((p) => p.toLowerCase().includes('família'))), [dishes]);
  const vip = useMemo(() => dishes.find((d) => d.profiles.some((p) => p.toLowerCase().includes('vip'))), [dishes]);

  if (dishes.length === 0) {
    return (
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">
          <Sparkles className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">Adicione pratos ao cardápio para gerar insights</p>
        </CardContent>
      </Card>
    );
  }

  const opportunities = [
    family && { icon: Cake, situation: 'Maria faz aniversário amanhã', dish: family,
      message: `Maria, seu ${family.name.toLowerCase()} preferido está esperando por você 🎉` },
    vip && { icon: AlertTriangle, situation: 'João sumiu há 28 dias', dish: vip,
      message: `João, o ${vip.name.toLowerCase()} que você ama está com saudade de você 🦐` },
    highMargin && { icon: CalendarDays, situation: 'Feriado na sexta-feira', dish: highMargin,
      message: `Feriado merece um ${highMargin.name.toLowerCase()} especial. Reserve sua mesa!` },
  ].filter(Boolean) as Array<{ icon: any; situation: string; dish: MenuDish; message: string }>;

  return (
    <div className="space-y-6">
      {/* Combinações */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Combinações Inteligentes</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            family && { who: 'Famílias pedem mais', dish: family.name },
            vip && { who: 'Clientes VIP preferem', dish: vip.name },
            highMargin && { who: 'Maior margem do cardápio', dish: highMargin.name },
          ].filter(Boolean).map((c: any, i) => (
            <Card key={i} className="border hover:border-primary/40 transition-colors">
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground">{c.who} →</p>
                <p className="font-bold text-base mt-1">{c.dish}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Oportunidades */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Oportunidades de Campanha</h2>
        {opportunities.length === 0 ? (
          <p className="text-sm text-muted-foreground">Configure perfis e margens nos pratos para gerar oportunidades.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {opportunities.map((op, i) => {
              const Icon = op.icon;
              return (
                <Card key={i} className="border hover:border-primary transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 font-medium">
                      <Icon className="h-5 w-5 text-primary" />
                      <span>{op.situation}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Prato sugerido: <strong>{op.dish.name}</strong></p>
                    <p className="text-sm italic bg-muted/40 rounded p-2 border-l-2 border-primary">"{op.message}"</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-primary hover:bg-primary/90"
                        onClick={() => onCreateCampaign(op.dish, op.situation)}>
                        Criar Campanha
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => toast.info('Sugestão ignorada')}>
                        Ignorar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Estatísticas */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Estatísticas do Cardápio</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Total de pratos" value={String(dishes.length)} />
          <StatCard label="Maior margem" value={highMargin?.name ?? '—'} />
          <StatCard label="Categoria mais comum" value={mostCommon(dishes.map((d) => CATEGORY_LABEL[d.category as DishCategory]))} />
          <StatCard label="Perfil mais frequente" value={mostCommon(dishes.flatMap((d) => d.profiles))} />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="p-4">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <p className="font-semibold mt-1 truncate">{value}</p>
    </CardContent></Card>
  );
}

function mostCommon(arr: string[]): string {
  if (arr.length === 0) return '—';
  const m = new Map<string, number>();
  for (const s of arr) m.set(s, (m.get(s) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/* ============ Campanha ============ */
function CampaignDialog({
  open, onOpenChange, dish, situation,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; dish: MenuDish | null; situation: string;
}) {
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('clientes-amam');
  const [whenStr, setWhenStr] = useState('');
  const [postIG, setPostIG] = useState(false);

  useMemo(() => {
    if (dish) setMessage(`${situation}\n\nQue tal aproveitar nosso ${dish.name}? Reserve agora!`);
  }, [dish, situation]);

  if (!dish) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Criar campanha — {dish.name}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          {/* Preview */}
          <div className="rounded-lg overflow-hidden border bg-muted/30">
            {dish.photo_url ? (
              <img src={dish.photo_url} alt={dish.name} className="w-full aspect-square object-cover max-h-64" />
            ) : (
              <div className="w-full aspect-square flex items-center justify-center text-muted-foreground"><ImageOff className="h-10 w-10" /></div>
            )}
            <div className="p-3 text-sm">
              <p className="font-bold">{dish.name}</p>
              <p className="text-xs text-muted-foreground">{situation}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Mensagem WhatsApp</Label>
            <Textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Enviar para quem?</Label>
            <select value={audience} onChange={(e) => setAudience(e.target.value)}
              className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="cliente-especifico">Cliente específico</option>
              <option value="clientes-amam">Todos os clientes que amam esse prato</option>
              <option value="risco">Clientes em risco</option>
              <option value="aniversariantes">Aniversariantes do mês</option>
              <option value="optin">Todos com opt-in</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data e hora de envio</Label>
              <input type="datetime-local" value={whenStr} onChange={(e) => setWhenStr(e.target.value)}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm dark:[&::-webkit-calendar-picker-indicator]:invert" />
            </div>
            <label className="flex items-center gap-2 text-sm mt-7">
              <input type="checkbox" checked={postIG} onChange={(e) => setPostIG(e.target.checked)} />
              Publicar no Instagram também
            </label>
          </div>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={() => toast.info('Geração com IA em breve')}>
            <Sparkles className="h-4 w-4 mr-1" /> Gerar nova versão com IA
          </Button>
          <Button className="bg-primary hover:bg-primary/90" onClick={() => { toast.success('Campanha agendada'); onOpenChange(false); }}>
            Aprovar e Agendar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}