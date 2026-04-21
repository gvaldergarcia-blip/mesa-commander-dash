import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Camera, QrCode, Plus, ScanLine, CheckCircle2, Trash2, Printer, ClipboardList,
  ShieldCheck, Users, Clock, Sunrise, Moon, Sparkles, Thermometer, PackageCheck,
  Utensils, Coffee, Wine, Refrigerator, Brush, AlertTriangle, Truck, type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  useChecklistCategories, useChecklistItems, useChecklistCompletionsToday,
  useSeedDefaultCategories, useDeleteItem, useCompleteItem, uploadChecklistPhoto,
  useChecklistRealtime,
  ChecklistItem, ChecklistCategory, ChecklistCompletion,
} from '@/hooks/useChecklists';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { QrCodeDialog } from '@/components/checklists/QrCodeDialog';
import { AddItemDialog } from '@/components/checklists/AddItemDialog';
import { AddCategoryDialog } from '@/components/checklists/AddCategoryDialog';
import { ScanQrDialog } from '@/components/checklists/ScanQrDialog';
import { ChecklistValidationSuccess } from '@/components/checklists/ChecklistValidationSuccess';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Mode = 'gestor' | 'equipe';

const ICON_MAP: Record<string, LucideIcon> = {
  ClipboardList, Sunrise, Moon, Sparkles, Thermometer, PackageCheck,
  Utensils, Coffee, Wine, Refrigerator, Brush, ShieldCheck, AlertTriangle, Truck,
};

const renderIcon = (name: string | null | undefined, className = 'h-4 w-4') => {
  const Icon = ICON_MAP[name ?? 'ClipboardList'] ?? ClipboardList;
  return <Icon className={className} />;
};

export default function ChecklistsPage() {
  const { itemId: routeScanItemId } = useParams<{ itemId?: string }>();
  const navigate = useNavigate();
  const { restaurantId, restaurant } = useRestaurant();
  const [mode, setMode] = useState<Mode>('gestor');

  // Realtime sync — invalidates queries on any change
  useChecklistRealtime();

  const { data: categories = [], isLoading: loadingCats } = useChecklistCategories();
  const { data: items = [] } = useChecklistItems();
  const { data: completions = [] } = useChecklistCompletionsToday();
  const seed = useSeedDefaultCategories();
  const complete = useCompleteItem();

  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [qrItem, setQrItem] = useState<ChecklistItem | null>(null);
  const [scanItem, setScanItem] = useState<ChecklistItem | null>(null);
  const [addItemForCat, setAddItemForCat] = useState<ChecklistCategory | null>(null);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [validatedItemName, setValidatedItemName] = useState<string | null>(null);
  const handledRouteScanRef = useRef<string | null>(null);

  // Auto-seed first time
  const seededRef = useRef(false);
  useEffect(() => {
    if (!loadingCats && categories.length === 0 && restaurantId && !seed.isPending && !seededRef.current) {
      seededRef.current = true;
      seed.mutate(undefined, {
        onError: (e: any) => {
          console.error('[Checklists] auto-seed failed:', e);
          toast.error('Não foi possível criar as categorias padrão. Tente "Nova Categoria".');
          seededRef.current = false;
        },
      });
    }
  }, [loadingCats, categories.length, restaurantId, seed]);

  useEffect(() => {
    if (!activeCat && categories.length > 0) setActiveCat(categories[0].id);
  }, [categories, activeCat]);

  const completedItemIds = useMemo(() => new Set(completions.map((c) => c.item_id)), [completions]);
  const itemCompletion = useMemo(() => {
    const map = new Map<string, ChecklistCompletion>();
    for (const c of completions) if (!map.has(c.item_id)) map.set(c.item_id, c);
    return map;
  }, [completions]);

  useEffect(() => {
    if (!routeScanItemId || handledRouteScanRef.current === routeScanItemId || items.length === 0) return;
    const item = items.find((i) => i.id === routeScanItemId);
    if (!item) return;

    handledRouteScanRef.current = routeScanItemId;
    setMode('equipe');
    setActiveCat(item.category_id);

    const showSuccessScreen = () => {
      setValidatedItemName(item.name);
      window.setTimeout(() => {
        setValidatedItemName(null);
        navigate('/checklists', { replace: true });
      }, 1800);
    };

    if (completedItemIds.has(item.id)) {
      toast.success('Esta atividade já foi validada hoje');
      showSuccessScreen();
      return;
    }

    complete.mutate(
      { item_id: item.id, via_qr: true },
      {
        onSuccess: () => {
          toast.success('QR validado e atividade concluída');
          showSuccessScreen();
        },
        onError: () => {
          handledRouteScanRef.current = null;
        },
      },
    );
  }, [routeScanItemId, items, completedItemIds, complete, navigate]);

  const totalProgress = items.length === 0 ? 0 : Math.round((completedItemIds.size / items.length) * 100);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {validatedItemName && <ChecklistValidationSuccess itemName={validatedItemName} />}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-primary" />
            Checklists
          </h1>
          <p className="text-sm text-muted-foreground">
            Operação diária do {restaurant?.name ?? 'restaurante'} — abertura, fechamento e padrões.
          </p>
        </div>
        <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as Mode)} className="border rounded-lg p-1 bg-muted/30">
          <ToggleGroupItem value="gestor" className="gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <ShieldCheck className="h-4 w-4" /> Gestor
          </ToggleGroupItem>
          <ToggleGroupItem value="equipe" className="gap-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
            <Users className="h-4 w-4" /> Equipe
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Progress geral */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">Progresso geral de hoje</p>
            <span className="text-sm font-semibold text-primary">{totalProgress}%</span>
          </div>
          <Progress value={totalProgress} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {completedItemIds.size} de {items.length} itens concluídos
          </p>
        </CardContent>
      </Card>

      {/* Tabs por categoria */}
      {categories.length > 0 && activeCat && (
        <Tabs value={activeCat} onValueChange={setActiveCat}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <TabsList className="flex-wrap h-auto">
              {categories.map((c) => (
                <TabsTrigger key={c.id} value={c.id} className="gap-1.5">
                  {renderIcon(c.icon, 'h-3.5 w-3.5')}
                  {c.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {mode === 'gestor' && (
              <Button variant="outline" size="sm" onClick={() => setAddCatOpen(true)}>
                <Plus className="mr-1 h-4 w-4" /> Nova Categoria
              </Button>
            )}
          </div>

          {categories.map((category) => {
            const catItems = items.filter((i) => i.category_id === category.id);
            const catDone = catItems.filter((i) => completedItemIds.has(i.id)).length;
            const catProgress = catItems.length === 0 ? 0 : Math.round((catDone / catItems.length) * 100);
            return (
              <TabsContent key={category.id} value={category.id} className="space-y-4 mt-4">
                <CategoryPanel
                  mode={mode}
                  category={category}
                  items={catItems}
                  progress={catProgress}
                  doneCount={catDone}
                  completedItemIds={completedItemIds}
                  itemCompletion={itemCompletion}
                  onOpenQr={setQrItem}
                  onOpenScan={setScanItem}
                  onAddItem={() => setAddItemForCat(category)}
                />
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* Activity log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atividade recente</CardTitle>
        </CardHeader>
        <CardContent>
          {completions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma atividade registrada hoje.</p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-auto">
              {completions.slice(0, 10).map((c) => {
                const it = items.find((i) => i.id === c.item_id);
                return (
                  <li key={c.id} className="flex items-center gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="font-medium flex-1 truncate">{it?.name ?? 'Item'}</span>
                    <span className="text-muted-foreground">{c.completed_by_name ?? 'Equipe'}</span>
                    <span className="text-muted-foreground tabular-nums">{format(new Date(c.completed_at), 'HH:mm', { locale: ptBR })}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <QrCodeDialog
        open={!!qrItem}
        onOpenChange={(o) => !o && setQrItem(null)}
        item={qrItem}
        category={qrItem ? categories.find((c) => c.id === qrItem.category_id) ?? null : null}
      />
      <ScanQrDialog
        open={!!scanItem}
        onOpenChange={(o) => !o && setScanItem(null)}
        item={scanItem}
        onScanned={async () => {
          if (!scanItem) return;
          await complete.mutateAsync({ item_id: scanItem.id, via_qr: true });
          toast.success('QR validado e atividade concluída');
          setValidatedItemName(scanItem.name);
          window.setTimeout(() => setValidatedItemName(null), 1800);
        }}
      />
      <AddItemDialog
        open={!!addItemForCat}
        onOpenChange={(o) => !o && setAddItemForCat(null)}
        categoryId={addItemForCat?.id ?? ''}
        categoryName={addItemForCat?.name ?? ''}
      />
      <AddCategoryDialog open={addCatOpen} onOpenChange={setAddCatOpen} />
    </div>
  );
}

interface CategoryPanelProps {
  mode: Mode;
  category: ChecklistCategory;
  items: ChecklistItem[];
  progress: number;
  doneCount: number;
  completedItemIds: Set<string>;
  itemCompletion: Map<string, ChecklistCompletion>;
  onOpenQr: (item: ChecklistItem) => void;
  onOpenScan: (item: ChecklistItem) => void;
  onAddItem: () => void;
}

function CategoryPanel({
  mode, category, items, progress, doneCount, completedItemIds, itemCompletion, onOpenQr, onOpenScan, onAddItem,
}: CategoryPanelProps) {
  const printAll = () => {
    const qrItems = items.filter((i) => i.has_qr);
    if (qrItems.length === 0) {
      toast.error('Nenhum item desta categoria possui QR Code.');
      return;
    }
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    const blocks = qrItems.map((it) =>
      `<div class="card"><div id="qr-${it.id}"></div><h3>${it.name}</h3><p>${category.name}</p></div>`
    ).join('');
    w.document.write(`<!doctype html><html><head><title>QRs ${category.name}</title>
      <style>
        body{font-family:Inter,system-ui,sans-serif;padding:24px;color:#111}
        h1{font-size:20px;margin:0 0 16px}
        .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:0}
        .card{border-right:1px dashed #999;border-bottom:1px dashed #999;padding:24px;text-align:center}
        .card:nth-child(2n){border-right:none}
        .card h3{font-size:14px;margin:12px 0 4px;font-weight:600}
        .card p{color:#666;font-size:12px;margin:0}
        canvas{margin:0 auto}
        @media print { .card{break-inside:avoid} }
      </style></head><body>
      <h1>QRs — ${category.name}</h1><div class="grid">${blocks}</div>
      <script src="https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js"></script>
      <script>
        const items = ${JSON.stringify(qrItems.map((i) => ({ id: i.id, val: `${typeof window !== 'undefined' ? window.location.origin : ''}/checklists/scan/${i.id}` })))};
        Promise.all(items.map(i => QRCode.toCanvas(i.val, { width: 180 }).then(c => document.getElementById('qr-'+i.id).appendChild(c))))
          .then(() => setTimeout(() => window.print(), 400));
      </script>
      </body></html>`);
    w.document.close();
  };

  const hasAnyQr = items.some((i) => i.has_qr);

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {renderIcon(category.icon, 'h-4 w-4 text-primary')}
            {category.name}
          </CardTitle>
          <div className="flex gap-2">
            {mode === 'gestor' && hasAnyQr && (
              <Button variant="outline" size="sm" onClick={printAll}>
                <Printer className="mr-1 h-4 w-4" /> Imprimir todos os QRs
              </Button>
            )}
            {mode === 'gestor' && (
              <Button size="sm" onClick={onAddItem}>
                <Plus className="mr-1 h-4 w-4" /> Adicionar Item
              </Button>
            )}
          </div>
        </div>
        {items.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">{doneCount} de {items.length} concluídos</span>
              <span className="text-xs font-semibold text-primary">{progress}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum item nesta categoria. {mode === 'gestor' && 'Clique em "Adicionar Item" para começar.'}
          </p>
        ) : (
          <ul className="divide-y">
            {items.map((it) => (
              <ItemRow
                key={it.id}
                mode={mode}
                item={it}
                done={completedItemIds.has(it.id)}
                completion={itemCompletion.get(it.id)}
                onOpenQr={() => onOpenQr(it)}
                onOpenScan={() => onOpenScan(it)}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

interface ItemRowProps {
  mode: Mode;
  item: ChecklistItem;
  done: boolean;
  completion: ChecklistCompletion | undefined;
  onOpenQr: () => void;
  onOpenScan: () => void;
}

function ItemRow({ mode, item, done, completion, onOpenQr, onOpenScan }: ItemRowProps) {
  const { restaurantId } = useRestaurant();
  const complete = useCompleteItem();
  const del = useDeleteItem();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingScanComplete, setPendingScanComplete] = useState(false);

  // After QR scan succeeds (real camera read), either prompt for photo or complete directly
  const handleScanFinished = () => {
    if (item.requires_photo) {
      setPendingScanComplete(true);
      setTimeout(() => fileRef.current?.click(), 200);
    } else {
      complete.mutate({ item_id: item.id, via_qr: true });
    }
  };

  // Listen for the global scan-success event and react when it's for this item
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.itemId === item.id) handleScanFinished();
    };
    window.addEventListener('checklist:scan-success', handler);
    return () => window.removeEventListener('checklist:scan-success', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id]);

  const handleConclude = async () => {
    if (item.requires_photo) {
      fileRef.current?.click();
      return;
    }
    complete.mutate({ item_id: item.id, via_qr: false });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !restaurantId) {
      setPendingScanComplete(false);
      return;
    }
    try {
      setUploading(true);
      const url = await uploadChecklistPhoto(f, restaurantId);
      await complete.mutateAsync({ item_id: item.id, via_qr: pendingScanComplete, photo_url: url });
      toast.success('Foto enviada e item concluído');
    } catch (err: any) {
      toast.error(err?.message ?? 'Falha no upload');
    } finally {
      setUploading(false);
      setPendingScanComplete(false);
      e.target.value = '';
    }
  };

  return (
    <li className="py-3 flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {item.is_critical && !done && (
          <span className="relative flex h-2.5 w-2.5 shrink-0" aria-label="Item crítico pendente">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-70" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
          </span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('font-medium text-sm truncate', done && 'line-through text-muted-foreground')}>
              {item.name}
            </span>
            {item.is_critical && (
              <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">CRÍTICO</Badge>
            )}
            {item.requires_photo && (
              <Camera className="h-3.5 w-3.5 text-muted-foreground" aria-label="Exige foto" />
            )}
            {item.has_qr && (
              <QrCode className="h-3.5 w-3.5 text-muted-foreground" aria-label="Validação por QR" />
            )}
            {item.scheduled_time && (
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                <Clock className="h-3 w-3" /> {item.scheduled_time}
              </span>
            )}
          </div>
          {done && completion && (
            <p className="text-xs text-muted-foreground mt-0.5">
              <CheckCircle2 className="inline h-3 w-3 text-green-500 mr-1" />
              {completion.completed_by_name ?? 'Equipe'} • {format(new Date(completion.completed_at), 'HH:mm', { locale: ptBR })}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {mode === 'gestor' ? (
          <>
            {item.has_qr && (
              <Button size="sm" variant="outline" onClick={onOpenQr}>
                <QrCode className="mr-1 h-4 w-4" /> Gerar QR
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => del.mutate(item.id)} aria-label="Remover">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </>
        ) : done ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" /> Concluído
          </Badge>
        ) : (
          <>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
            {item.has_qr ? (
              <Button size="sm" variant="outline" onClick={onOpenScan}>
                <ScanLine className="mr-1 h-4 w-4" /> Escanear QR
              </Button>
            ) : (
              <Button size="sm" onClick={handleConclude} disabled={uploading || complete.isPending}>
                {item.requires_photo ? <Camera className="mr-1 h-4 w-4" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                {uploading ? 'Enviando…' : 'Concluir'}
              </Button>
            )}
          </>
        )}
      </div>
    </li>
  );
}
