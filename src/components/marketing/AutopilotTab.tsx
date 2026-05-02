import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sparkles, Loader2, FileText, Camera, Check, X, Bot, Send,
  ChevronLeft, ChevronRight, Download, Copy, Trash2, Star, StarOff, Settings,
  ImageIcon, Type, RotateCcw, ArrowLeftRight,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

type Dish = {
  id: string;
  restaurant_id: string;
  name: string;
  description: string | null;
  price: number | null;
  category: "entrada" | "prato_principal" | "sobremesa" | "bebida" | "outro";
  dish_photo_url: string | null;
  is_featured: boolean;
};
type Suggestion = {
  id: string;
  restaurant_id: string;
  dish_id: string | null;
  suggested_for_date: string;
  status: "pending" | "approved" | "dismissed" | "posted";
  copy_text: string | null;
  current_version_id: string | null;
  context_data: any;
  created_at: string;
};
type Version = {
  id: string;
  suggestion_id: string;
  version_number: number;
  image_url: string;
  edit_instruction: string | null;
  created_at: string;
};
type ChatMessage = {
  id: string;
  role: "user" | "ai" | "system";
  content: string;
  version_id: string | null;
  created_at: string;
};

const CATEGORY_LABELS: Record<Dish["category"], string> = {
  entrada: "Entradas",
  prato_principal: "Pratos Principais",
  sobremesa: "Sobremesas",
  bebida: "Bebidas",
  outro: "Outros",
};

const ALL_CATEGORIES: Dish["category"][] = ["entrada", "prato_principal", "sobremesa", "bebida", "outro"];

export default function AutopilotTab() {
  const { restaurant, refetchRestaurant } = useRestaurant() as any;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [pendingSug, setPendingSug] = useState<Suggestion | null>(null);
  const [pendingVersion, setPendingVersion] = useState<Version | null>(null);
  const [approvedSugs, setApprovedSugs] = useState<Array<Suggestion & { version: Version | null }>>([]);
  const [extracting, setExtracting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const restaurantId = restaurant?.id;
  const hasMenu = !!restaurant?.menu_url;
  const extractedAt = restaurant?.menu_dishes_extracted_at;
  const autopilotOn = !!restaurant?.social_autopilot_enabled;
  const enabledCats: string[] = restaurant?.social_autopilot_categories || ["prato_principal"];

  const loadAll = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const [dishesR, pendingR, approvedR] = await Promise.all([
      supabase.from("restaurant_dishes").select("*").eq("restaurant_id", restaurantId).order("category").order("name"),
      supabase
        .from("social_post_suggestions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("social_post_suggestions")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .eq("status", "approved")
        .order("approved_at", { ascending: false }),
    ]);
    setDishes((dishesR.data as Dish[]) || []);
    setPendingSug((pendingR.data as Suggestion) || null);
    if (pendingR.data?.current_version_id) {
      const { data: v } = await supabase
        .from("social_post_versions")
        .select("*")
        .eq("id", pendingR.data.current_version_id)
        .maybeSingle();
      setPendingVersion((v as Version) || null);
    } else {
      setPendingVersion(null);
    }
    // Hydrate approved with their current version
    const approved = (approvedR.data as Suggestion[]) || [];
    const versionIds = approved.map((s) => s.current_version_id).filter(Boolean) as string[];
    let versionsMap: Record<string, Version> = {};
    if (versionIds.length) {
      const { data: vs } = await supabase.from("social_post_versions").select("*").in("id", versionIds);
      (vs as Version[] | null)?.forEach((v) => { versionsMap[v.id] = v; });
    }
    setApprovedSugs(approved.map((s) => ({ ...s, version: s.current_version_id ? versionsMap[s.current_version_id] || null : null })));
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, [restaurantId]);

  // ─── Actions ───
  const handleExtractMenu = async () => {
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-menu-dishes", { body: { restaurantId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`${data.count} pratos extraídos do cardápio!`);
      await refetchRestaurant?.();
      await loadAll();
    } catch (e: any) {
      toast.error(e.message || "Erro ao analisar cardápio");
    } finally {
      setExtracting(false);
    }
  };

  const toggleFeatured = async (dish: Dish) => {
    const { error } = await supabase.from("restaurant_dishes").update({ is_featured: !dish.is_featured }).eq("id", dish.id);
    if (error) return toast.error("Erro ao atualizar");
    setDishes((prev) => prev.map((d) => (d.id === dish.id ? { ...d, is_featured: !d.is_featured } : d)));
  };

  const handleUploadDishPhoto = async (dish: Dish, file: File) => {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${restaurantId}/${dish.id}-${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("dish-photos").upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) return toast.error("Erro no upload: " + upErr.message);
    const { data: pub } = supabase.storage.from("dish-photos").getPublicUrl(path);
    const { error: updErr } = await supabase.from("restaurant_dishes").update({ dish_photo_url: pub.publicUrl }).eq("id", dish.id);
    if (updErr) return toast.error("Erro ao salvar foto");
    setDishes((prev) => prev.map((d) => (d.id === dish.id ? { ...d, dish_photo_url: pub.publicUrl } : d)));
    toast.success("Foto adicionada!");
  };

  const removeDishPhoto = async (dish: Dish) => {
    await supabase.from("restaurant_dishes").update({ dish_photo_url: null }).eq("id", dish.id);
    setDishes((prev) => prev.map((d) => (d.id === dish.id ? { ...d, dish_photo_url: null } : d)));
  };

  const updateAutopilotEnabled = async (enabled: boolean) => {
    const { error } = await supabase.from("restaurants").update({ social_autopilot_enabled: enabled }).eq("id", restaurantId);
    if (error) return toast.error("Erro");
    await refetchRestaurant?.();
    toast.success(enabled ? "Auto-pilot ativado" : "Auto-pilot desativado");
  };

  const toggleCategory = async (cat: string) => {
    const next = enabledCats.includes(cat) ? enabledCats.filter((c) => c !== cat) : [...enabledCats, cat];
    const { error } = await supabase.from("restaurants").update({ social_autopilot_categories: next }).eq("id", restaurantId);
    if (error) return toast.error("Erro");
    await refetchRestaurant?.();
  };

  const handleGenerateNow = async () => {
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-suggest-daily", { body: { restaurantId } });
      if (error) throw error;
      const r = data?.results?.[0];
      if (r?.error) throw new Error(`${r.error}${r.detail ? ": " + r.detail : ""}`);
      if (r?.skipped) toast.info(r.skipped === "already_has_today" ? "Já existe sugestão pra hoje" : "Nenhum prato elegível (precisa ter foto + estar marcado como destaque)");
      else toast.success(`Sugestão gerada: ${r?.dish || "ok"}`);
      await loadAll();
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar");
    } finally {
      setExtracting(false);
    }
  };

  const handleApprove = async (action: "approve" | "dismiss") => {
    if (!pendingSug) return;
    const { error } = await supabase.functions.invoke("social-approve-post", { body: { suggestionId: pendingSug.id, action } });
    if (error) return toast.error("Erro");
    toast.success(action === "approve" ? "Aprovado! Pronto pra postar." : "Sugestão descartada");
    await loadAll();
  };

  // ─── Computed states ───
  const eligibleDishesCount = useMemo(
    () => dishes.filter((d) => d.is_featured && d.dish_photo_url && enabledCats.includes(d.category)).length,
    [dishes, enabledCats]
  );

  // ──────────────── RENDER ────────────────
  if (loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  // STATE 1: Sem cardápio
  if (!hasMenu) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <FileText className="w-7 h-7 text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Configure seu cardápio primeiro</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Pra IA gerar posts dos seus pratos reais, precisamos do cardápio cadastrado.
            </p>
          </div>
          <Button onClick={() => navigate("/settings")} className="gap-2">
            <Settings className="w-4 h-4" /> Ir para Configurações
          </Button>
        </CardContent>
      </Card>
    );
  }

  // STATE 2: Cardápio existe, não foi extraído
  if (!extractedAt && dishes.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Vamos analisar seu cardápio</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
              A IA vai ler seu cardápio e listar todos os pratos por categoria, pra você revisar e marcar os preferidos.
            </p>
          </div>
          <Button onClick={handleExtractMenu} disabled={extracting} className="gap-2">
            {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {extracting ? "Analisando cardápio..." : "Analisar cardápio agora"}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // STATE 3 + 4: Pratos extraídos → mostra: config + lista de pratos + sugestão pendente + aprovados
  const dishesByCategory = ALL_CATEGORIES.map((cat) => ({
    category: cat,
    dishes: dishes.filter((d) => d.category === cat),
  })).filter((g) => g.dishes.length > 0);

  return (
    <div className="space-y-6">
      {/* Auto-pilot config */}
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold flex items-center gap-2">
                <Bot className="w-4 h-4 text-primary" /> Auto-pilot de Posts
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Todo dia às 11h, a IA gera 1 post pronto pra você aprovar — usando seus pratos com foto real.
              </p>
            </div>
            <Switch checked={autopilotOn} onCheckedChange={updateAutopilotEnabled} />
          </div>

          {autopilotOn && (
            <>
              <Separator />
              <div>
                <Label className="text-xs font-medium">Categorias permitidas no rodízio</Label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {ALL_CATEGORIES.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1.5 rounded-full text-xs border transition ${
                        enabledCats.includes(cat)
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/40 text-muted-foreground border-border hover:bg-muted"
                      }`}
                    >
                      {CATEGORY_LABELS[cat]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border">
                <div className="text-xs">
                  <span className="font-semibold">{eligibleDishesCount}</span> {eligibleDishesCount === 1 ? "prato elegível" : "pratos elegíveis"}
                  <span className="text-muted-foreground"> (com foto + destaque + categoria ativa)</span>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={handleGenerateNow} disabled={extracting || eligibleDishesCount === 0}>
                  {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  Gerar agora (teste)
                </Button>
              </div>

              {eligibleDishesCount === 0 && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-400">
                  ⚠️ Nenhum prato elegível ainda. Marque pratos com ⭐ e adicione fotos reais abaixo.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Sugestão pendente */}
      {pendingSug && pendingVersion && (
        <PendingSuggestionCard
          suggestion={pendingSug}
          version={pendingVersion}
          onApprove={() => handleApprove("approve")}
          onDismiss={() => handleApprove("dismiss")}
          onOpenChat={() => setChatOpen(true)}
        />
      )}

      {/* Aprovados (fila) */}
      {approvedSugs.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Check className="w-4 h-4 text-green-600" /> Prontos pra postar ({approvedSugs.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {approvedSugs.map((s) => <ApprovedCard key={s.id} item={s} onChange={loadAll} />)}
          </div>
        </div>
      )}

      {/* Lista de pratos */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Seus pratos ({dishes.length})</h3>
          <Button size="sm" variant="ghost" onClick={handleExtractMenu} disabled={extracting} className="text-xs gap-1.5">
            {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            Re-analisar cardápio
          </Button>
        </div>
        <div className="space-y-5">
          {dishesByCategory.map((g) => (
            <div key={g.category}>
              <div className="flex items-center gap-2 mb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{CATEGORY_LABELS[g.category]}</h4>
                <Badge variant="secondary" className="text-[10px]">{g.dishes.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {g.dishes.map((d) => (
                  <DishRow key={d.id} dish={d} onToggleFeatured={() => toggleFeatured(d)} onUploadPhoto={(f) => handleUploadDishPhoto(d, f)} onRemovePhoto={() => removeDishPhoto(d)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat dialog */}
      {chatOpen && pendingSug && (
        <ChatRefineDialog
          open={chatOpen}
          onClose={() => setChatOpen(false)}
          suggestionId={pendingSug.id}
          onAfterRefine={loadAll}
        />
      )}
    </div>
  );
}

// ───────────────────── Components ─────────────────────

function DishRow({ dish, onToggleFeatured, onUploadPhoto, onRemovePhoto }: {
  dish: Dish;
  onToggleFeatured: () => void;
  onUploadPhoto: (file: File) => void;
  onRemovePhoto: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  return (
    <div className={`flex items-center gap-3 p-2.5 rounded-lg border ${dish.is_featured ? "bg-primary/5 border-primary/30" : "bg-card"}`}>
      <button onClick={onToggleFeatured} className="shrink-0">
        {dish.is_featured ? <Star className="w-4 h-4 fill-amber-400 text-amber-400" /> : <StarOff className="w-4 h-4 text-muted-foreground" />}
      </button>
      {dish.dish_photo_url ? (
        <div className="relative shrink-0">
          <img src={dish.dish_photo_url} alt={dish.name} className="w-12 h-12 object-cover rounded-md" />
          <button onClick={onRemovePhoto} className="absolute -top-1 -right-1 bg-background border rounded-full p-0.5">
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      ) : (
        <button onClick={() => fileRef.current?.click()} className="shrink-0 w-12 h-12 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary hover:bg-primary/5">
          <Camera className="w-4 h-4 text-muted-foreground" />
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadPhoto(f); e.target.value = ""; }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{dish.name}</p>
        <p className="text-xs text-muted-foreground truncate">{dish.price ? `R$ ${dish.price.toFixed(2)}` : "—"}{dish.description ? ` · ${dish.description}` : ""}</p>
      </div>
    </div>
  );
}

function PendingSuggestionCard({ suggestion, version, onApprove, onDismiss, onOpenChat }: {
  suggestion: Suggestion;
  version: Version;
  onApprove: () => void;
  onDismiss: () => void;
  onOpenChat: () => void;
}) {
  return (
    <Card className="border-primary/40 bg-primary/5">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Badge className="bg-primary text-primary-foreground gap-1"><Sparkles className="w-3 h-3" /> Sugestão de hoje</Badge>
          <span className="text-xs text-muted-foreground">v{version.version_number}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <img src={version.image_url} alt="post" className="w-full rounded-lg border" />
          <div className="flex flex-col">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Legenda</p>
            <p className="text-sm whitespace-pre-wrap flex-1">{suggestion.copy_text || "—"}</p>
            <div className="grid grid-cols-3 gap-2 mt-4">
              <Button onClick={onApprove} className="gap-1.5"><Check className="w-4 h-4" /> Aprovar</Button>
              <Button variant="outline" onClick={onOpenChat} className="gap-1.5"><Bot className="w-4 h-4" /> Editar</Button>
              <Button variant="ghost" onClick={onDismiss} className="gap-1.5 text-muted-foreground"><X className="w-4 h-4" /> Descartar</Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ApprovedCard({ item, onChange }: { item: Suggestion & { version: Version | null }; onChange: () => void }) {
  const handleDownload = async () => {
    if (!item.version?.image_url) return;
    try {
      const r = await fetch(item.version.image_url);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `post-${item.suggested_for_date}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download iniciado");
    } catch { window.open(item.version.image_url, "_blank"); }
  };
  const handleCopy = () => {
    navigator.clipboard.writeText(item.copy_text || "");
    toast.success("Legenda copiada!");
  };
  const handleDelete = async () => {
    if (!confirm("Remover este post da fila?")) return;
    await supabase.from("social_post_suggestions").update({ status: "dismissed" }).eq("id", item.id);
    onChange();
  };
  return (
    <Card className="overflow-hidden">
      {item.version?.image_url && <img src={item.version.image_url} alt="" className="w-full aspect-square object-cover" />}
      <CardContent className="p-2 space-y-2">
        <p className="text-[10px] text-muted-foreground">{item.suggested_for_date}</p>
        <div className="grid grid-cols-3 gap-1">
          <Button size="sm" variant="ghost" onClick={handleDownload} className="h-7 px-1"><Download className="w-3 h-3" /></Button>
          <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 px-1"><Copy className="w-3 h-3" /></Button>
          <Button size="sm" variant="ghost" onClick={handleDelete} className="h-7 px-1 text-destructive"><Trash2 className="w-3 h-3" /></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ChatRefineDialog({ open, onClose, suggestionId, onAfterRefine }: {
  open: boolean;
  onClose: () => void;
  suggestionId: string;
  onAfterRefine: () => void;
}) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [refining, setRefining] = useState(false);
  const [forcedAction, setForcedAction] = useState<"image" | "caption" | "both" | null>(null);
  const [copyText, setCopyText] = useState<string>("");
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    const [vsR, msgR, sugR] = await Promise.all([
      supabase.from("social_post_versions").select("*").eq("suggestion_id", suggestionId).order("version_number"),
      supabase.from("social_post_chat_messages").select("*").eq("suggestion_id", suggestionId).order("created_at"),
      supabase.from("social_post_suggestions").select("copy_text, current_version_id").eq("id", suggestionId).maybeSingle(),
    ]);
    const vs = (vsR.data as Version[]) || [];
    setVersions(vs);
    const curId = (sugR.data as any)?.current_version_id;
    setCurrentVersionId(curId || null);
    const idx = curId ? Math.max(0, vs.findIndex((v) => v.id === curId)) : vs.length - 1;
    setActiveIdx(idx);
    setMessages((msgR.data as ChatMessage[]) || []);
    setCopyText((sugR.data as any)?.copy_text || "");
    setLoading(false);
  };
  useEffect(() => { if (open) load(); }, [open, suggestionId]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, refining]);

  const handleSend = async () => {
    if (!input.trim() || refining) return;
    const instruction = input.trim();
    setInput("");
    setRefining(true);
    const action = forcedAction;
    setForcedAction(null);
    // Optimistic
    setMessages((m) => [...m, { id: crypto.randomUUID(), role: "user", content: instruction, version_id: null, created_at: new Date().toISOString() }]);
    try {
      const { data, error } = await supabase.functions.invoke("social-refine-image", { body: { suggestionId, instruction, action } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      await load();
      onAfterRefine();
      if (data?.version) toast.success(`v${data.version.version_number} gerada!`);
      else if (data?.copy_text) toast.success("Legenda atualizada!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao refinar");
    } finally {
      setRefining(false);
    }
  };

  const handleSetCurrent = async (v: Version) => {
    const { error } = await supabase.from("social_post_suggestions").update({ current_version_id: v.id }).eq("id", suggestionId);
    if (error) return toast.error("Erro ao trocar versão");
    toast.success(`v${v.version_number} marcada como atual`);
    setCurrentVersionId(v.id);
    onAfterRefine();
  };

  const handleSaveCaption = async () => {
    const { error } = await supabase.from("social_post_suggestions").update({ copy_text: copyText }).eq("id", suggestionId);
    if (error) return toast.error("Erro ao salvar");
    toast.success("Legenda salva");
    onAfterRefine();
  };

  const QUICK_PROMPTS = [
    { label: "Fundo mais escuro", action: "image" as const },
    { label: "Tirar o preço", action: "image" as const },
    { label: "Mais apetitoso", action: "image" as const },
    { label: "Legenda mais curta", action: "caption" as const },
    { label: "Legenda divertida", action: "caption" as const },
    { label: "Adicionar CTA pra reservar", action: "caption" as const },
  ];

  const activeVersion = versions[activeIdx];
  const isCurrent = activeVersion?.id === currentVersionId;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Bot className="w-5 h-5 text-primary" /> Editor IA — peça o que quiser</DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-[1.1fr_1fr] gap-4 overflow-hidden flex-1">
            {/* Left: preview + versions + caption */}
            <div className="flex flex-col gap-3 overflow-y-auto pr-1">
              <div className="relative bg-muted/30 rounded-lg border flex items-center justify-center p-2">
                {activeVersion && <img src={activeVersion.image_url} alt="" className="max-h-[360px] w-auto rounded-md" />}
                {isCurrent && <Badge className="absolute top-2 left-2 bg-green-600 text-white">Atual</Badge>}
              </div>
              {versions.length > 1 && (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setActiveIdx(Math.max(0, activeIdx - 1))} disabled={activeIdx === 0}><ChevronLeft className="w-4 h-4" /></Button>
                    <span className="text-xs font-medium tabular-nums">v{activeVersion?.version_number} / {versions.length}</span>
                    <Button size="sm" variant="ghost" onClick={() => setActiveIdx(Math.min(versions.length - 1, activeIdx + 1))} disabled={activeIdx === versions.length - 1}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                  {!isCurrent && activeVersion && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => handleSetCurrent(activeVersion)}>
                      <RotateCcw className="w-3 h-3" /> Usar esta versão
                    </Button>
                  )}
                </div>
              )}
              {activeVersion?.edit_instruction && (
                <p className="text-[11px] text-muted-foreground italic px-1">"{activeVersion.edit_instruction}"</p>
              )}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5"><Type className="w-3 h-3" /> Legenda do post</Label>
                <Textarea value={copyText} onChange={(e) => setCopyText(e.target.value)} className="text-xs min-h-[110px] font-mono" />
                <div className="flex justify-end">
                  <Button size="sm" variant="outline" className="text-xs gap-1.5" onClick={handleSaveCaption}><Check className="w-3 h-3" /> Salvar legenda manualmente</Button>
                </div>
              </div>
            </div>

            {/* Right: chat */}
            <div className="flex flex-col h-full overflow-hidden border-l pl-4">
              <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 pr-1 mb-3">
                {messages.length === 0 && (
                  <div className="text-xs text-muted-foreground space-y-2">
                    <p>Converse com a IA. Ela edita imagem, legenda, ou só responde sua pergunta — entende sozinha o que você quer.</p>
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {QUICK_PROMPTS.map((q) => (
                        <button key={q.label} onClick={() => { setInput(q.label); setForcedAction(q.action); }} className="px-2 py-1 rounded-full bg-muted hover:bg-muted/70 border text-[11px]">
                          {q.action === "image" ? "🖼" : "✍️"} {q.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={`p-2.5 rounded-lg text-sm ${m.role === "user" ? "bg-primary/10 ml-6" : "bg-muted mr-6"}`}>
                    {m.role === "ai" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-blockquote:my-1">
                        <ReactMarkdown>{m.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    )}
                  </div>
                ))}
                {refining && (
                  <div className="p-2.5 rounded-lg text-sm bg-muted mr-6 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> {forcedAction === "caption" ? "Reescrevendo legenda..." : forcedAction === "image" ? "Gerando nova arte..." : "Pensando..."}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <div className="flex gap-1.5 items-center">
                  <span className="text-[10px] text-muted-foreground">Forçar:</span>
                  <button onClick={() => setForcedAction(forcedAction === "image" ? null : "image")} className={`px-2 py-0.5 rounded text-[10px] border ${forcedAction === "image" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                    🖼 Imagem
                  </button>
                  <button onClick={() => setForcedAction(forcedAction === "caption" ? null : "caption")} className={`px-2 py-0.5 rounded text-[10px] border ${forcedAction === "caption" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                    ✍️ Legenda
                  </button>
                  <button onClick={() => setForcedAction(forcedAction === "both" ? null : "both")} className={`px-2 py-0.5 rounded text-[10px] border ${forcedAction === "both" ? "bg-primary text-primary-foreground" : "bg-background"}`}>
                    <ArrowLeftRight className="w-2.5 h-2.5 inline" /> Ambos
                  </button>
                  <span className="text-[10px] text-muted-foreground ml-auto">⌘+Enter envia</span>
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder='Ex: "deixe a foto mais quente", "encurta a legenda e tira hashtag", "que horário fica melhor postar?"'
                    className="text-sm min-h-[70px]"
                    onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSend(); }}
                  />
                  <Button onClick={handleSend} disabled={refining || !input.trim()} size="icon"><Send className="w-4 h-4" /></Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}