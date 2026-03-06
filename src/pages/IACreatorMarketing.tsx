import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Sparkles,
  Copy,
  Check,
  Instagram,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Target,
  Palette,
  Hash,
  MessageSquare,
  Smartphone,
  ImageIcon,
  Download,
  Loader2,
  Upload,
  X as XIcon,
  Images,
  Trash2,
  Calendar,
  ToggleLeft,
  MapPin,
  Eye,
  RefreshCw,
  Filter,
  Settings,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ───────────────────────────────────────────────────────
interface CampaignForm {
  nomePrato: string;
  fraseRestaurante: string;
  precoOriginal: string;
  precoPromocional: string;
  desconto: string;
  objetivo: string;
  diaSemana: string;
  publicoAlvo: string;
  tomVoz: string;
  hasDiscount: boolean;
  includeLogo: boolean;
  includeAddress: boolean;
}

interface GeneratedContent {
  headline: string;
  subheadline: string;
  precoDestaque: string;
  cta: string;
  legenda: string;
  hashtags: string[];
  elementosVisuais: string[];
  storyVariacao: string;
}

interface PromotionAsset {
  id: string;
  dish_name: string;
  campaign_type: string;
  original_price: number | null;
  promo_price: number | null;
  discount_percent: number | null;
  campaign_goal: string | null;
  campaign_day: string | null;
  target_audience: string | null;
  brand_tone: string | null;
  include_logo: boolean;
  include_address: boolean;
  image_url: string | null;
  caption_text: string | null;
  status: string;
  created_at: string;
}

// ─── Content Generator (local, no API) ───────────────────────────
function generateContent(
  form: CampaignForm,
  restaurantName: string,
  cuisineType: string,
  city: string
): GeneratedContent {
  const { nomePrato, precoOriginal, precoPromocional, desconto, objetivo, diaSemana, publicoAlvo, tomVoz, hasDiscount } = form;

  const headlines: Record<string, string[]> = {
    sofisticado: [
      `${nomePrato} — Uma experiência que você merece.`,
      `Elegância no prato. ${nomePrato}.`,
      `Para paladares exigentes: ${nomePrato}.`,
    ],
    divertido: hasDiscount
      ? [`🔥 ${nomePrato} com desconto? SIM, POR FAVOR!`, `Seu ${diaSemana} ficou MUITO melhor agora!`, `Alerta de pecado: ${nomePrato} irresistível!`]
      : [`🔥 ${nomePrato}? SIM, POR FAVOR!`, `Seu ${diaSemana} ficou MUITO melhor agora!`, `Alerta de pecado: ${nomePrato} irresistível!`],
    familiar: [
      `A família toda merece um ${nomePrato} especial!`,
      `Mesa posta, família reunida, ${nomePrato} servido. ❤️`,
      `${nomePrato}: feito com amor, servido com carinho.`,
    ],
    jovem: hasDiscount
      ? [`Bora de ${nomePrato}? 🚀 Preço insano!`, `POV: Você descobriu ${nomePrato} com ${desconto}% OFF`, `${nomePrato} + ${diaSemana} = combo perfeito 🤌`]
      : [`Bora de ${nomePrato}? 🚀`, `POV: Você descobriu o ${nomePrato} 🤌`, `${nomePrato} + ${diaSemana} = combo perfeito 🤌`],
    tradicional: [
      `${nomePrato}: a receita que conquistou ${city}.`,
      `Tradição e sabor em cada garfada de ${nomePrato}.`,
      `O verdadeiro ${nomePrato}. Só aqui no ${restaurantName}.`,
    ],
  };

  const subheadlines: Record<string, string> = hasDiscount
    ? {
        sofisticado: `De R$ ${precoOriginal} por apenas R$ ${precoPromocional}. Exclusivo para quem sabe apreciar.`,
        divertido: `Era R$ ${precoOriginal}, agora é R$ ${precoPromocional}! Corre que é por tempo limitado! 🏃‍♂️`,
        familiar: `De R$ ${precoOriginal} por R$ ${precoPromocional}. Porque momentos em família não têm preço — mas o desconto ajuda!`,
        jovem: `De R$ ${precoOriginal} por R$ ${precoPromocional}. ${desconto}% OFF que você NÃO vai deixar passar.`,
        tradicional: `Valor especial: de R$ ${precoOriginal} por R$ ${precoPromocional}. Tradição com economia.`,
      }
    : {
        sofisticado: `Uma experiência gastronômica exclusiva no ${restaurantName}.`,
        divertido: `Vem provar esse prato incrível! Você não vai se arrepender! 🏃‍♂️`,
        familiar: `Uma delícia para toda a família saborear junta.`,
        jovem: `O prato que está bombando no ${restaurantName}! Vem conferir.`,
        tradicional: `Sabor autêntico que só o ${restaurantName} tem.`,
      };

  const ctas: Record<string, string> = {
    "atrair clientes em dia fraco": `📍 Garanta sua mesa neste ${diaSemana}! Reserve agora.`,
    "divulgar novidade": `🆕 Novidade no cardápio! Venha ser um dos primeiros a provar.`,
    "aumentar ticket médio": `🍷 Peça já o ${nomePrato} e complete sua experiência!`,
    "recuperar clientes": `💛 Faz tempo que não nos visita? Preparamos algo especial para você.`,
    "evento especial": `🎉 Evento especial! Garanta sua presença.`,
    "campanha institucional": `📍 Conheça o ${restaurantName} e viva essa experiência.`,
  };

  const objetivoLegendas: Record<string, string> = hasDiscount
    ? {
        "atrair clientes em dia fraco": `Seu ${diaSemana} merece ser especial. E a gente preparou o ${nomePrato} com um preço imperdível pra provar isso. De R$ ${precoOriginal} por apenas R$ ${precoPromocional} — são ${desconto}% de desconto! Aqui no ${restaurantName}, cada refeição é uma experiência.`,
        "divulgar novidade": `Novidade fresquinha no ${restaurantName}! Apresentamos o ${nomePrato} — já disponível com preço especial de lançamento: R$ ${precoPromocional} (antes R$ ${precoOriginal}). Venha provar antes de todo mundo!`,
        "aumentar ticket médio": `Que tal elevar sua experiência? O ${nomePrato} chegou para complementar sua refeição no ${restaurantName}. Por apenas R$ ${precoPromocional} (de R$ ${precoOriginal}), você adiciona ${desconto}% mais sabor à sua mesa.`,
        "recuperar clientes": `Sentimos sua falta! ❤️ E preparamos algo especial: ${nomePrato} com ${desconto}% de desconto — de R$ ${precoOriginal} por R$ ${precoPromocional}. Sua mesa favorita no ${restaurantName} está esperando.`,
        "evento especial": `Evento especial no ${restaurantName}! ${nomePrato} com ${desconto}% de desconto — de R$ ${precoOriginal} por R$ ${precoPromocional}. Não perca!`,
        "campanha institucional": `O ${restaurantName} apresenta: ${nomePrato}. De R$ ${precoOriginal} por R$ ${precoPromocional}. Venha conhecer!`,
      }
    : {
        "atrair clientes em dia fraco": `Seu ${diaSemana} merece ser especial. Venha experimentar o ${nomePrato} aqui no ${restaurantName}. Cada refeição é uma experiência única.`,
        "divulgar novidade": `Novidade fresquinha no ${restaurantName}! Apresentamos o ${nomePrato}. Venha provar essa delícia!`,
        "aumentar ticket médio": `Que tal elevar sua experiência? O ${nomePrato} chegou para complementar sua refeição no ${restaurantName}.`,
        "recuperar clientes": `Sentimos sua falta! ❤️ Preparamos algo especial: ${nomePrato}. Sua mesa favorita no ${restaurantName} está esperando.`,
        "evento especial": `Evento especial no ${restaurantName}! Venha experimentar o ${nomePrato} em uma noite inesquecível.`,
        "campanha institucional": `Conheça o ${restaurantName} e descubra o sabor do ${nomePrato}. Uma experiência gastronômica única.`,
      };

  const publicoHashtags: Record<string, string[]> = {
    casal: [`#jantarromantico`, `#datenight${city.replace(/\s/g, "")}`, `#casalfoodie`],
    família: [`#almocoemfamilia`, `#familiaemesa`, `#programafamiliar${city.replace(/\s/g, "")}`],
    amigos: [`#encontrodeamigos`, `#happyhour${city.replace(/\s/g, "")}`, `#rolefoodie`],
    "happy hour": [`#happyhour`, `#afterwork${city.replace(/\s/g, "")}`, `#drinks`],
    geral: [`#comidaboa`, `#gastro${city.replace(/\s/g, "")}`, `#foodlover`],
  };

  const headlineOptions = headlines[tomVoz] || headlines.divertido;
  const headline = headlineOptions[Math.floor(Math.random() * headlineOptions.length)];

  const baseHashtags = [
    `#${restaurantName.replace(/\s/g, "")}`,
    `#${cuisineType.replace(/\s/g, "")}`,
    `#restaurante${city.replace(/\s/g, "")}`,
    `#${nomePrato.replace(/\s/g, "").toLowerCase()}`,
    `#gastronomia`,
  ];
  const pubHashtags = publicoHashtags[publicoAlvo] || publicoHashtags.geral;
  const allHashtags = [...new Set([...baseHashtags, ...pubHashtags])].slice(0, 8);

  const elementosVisuais = hasDiscount
    ? [
        `🏷️ Selo circular com "-${desconto}%" em destaque`,
        `📸 Foto do ${nomePrato} em close com fundo desfocado`,
        `🎨 Contraste de cores quentes (dourado/vermelho) com fundo escuro`,
        `✍️ Tipografia bold para headline + script para subheadline`,
        `📍 Tag de localização: ${restaurantName}, ${city}`,
        `💰 Preço original riscado + preço promocional grande`,
      ]
    : [
        `📸 Foto do ${nomePrato} em close com fundo desfocado`,
        `🎨 Contraste de cores quentes (dourado/vermelho) com fundo escuro`,
        `✍️ Tipografia bold para headline`,
        `📍 Tag de localização: ${restaurantName}, ${city}`,
        `🎯 CTA visível e chamativo`,
      ];

  const storyVariacao = hasDiscount
    ? `🎬 STORY:\n• Slide 1: Imagem full-bleed do ${nomePrato} com texto "NOVIDADE 🔥"\n• Slide 2: Preço original riscado → preço promocional com animação de shake\n• Slide 3: CTA com sticker de enquete "Quem vem?" + link para reserva\n• Elementos: Countdown sticker para ${diaSemana}, emoji slider de 🤤`
    : `🎬 STORY:\n• Slide 1: Imagem full-bleed do ${nomePrato} com texto "NOVIDADE 🔥"\n• Slide 2: Nome do prato em destaque com animação\n• Slide 3: CTA com sticker de enquete "Quem vem?" + link para reserva\n• Elementos: Countdown sticker para ${diaSemana}, emoji slider de 🤤`;

  return {
    headline,
    subheadline: subheadlines[tomVoz] || subheadlines.divertido,
    precoDestaque: hasDiscount
      ? `De ~~R$ ${precoOriginal}~~ por **R$ ${precoPromocional}** (${desconto}% OFF)`
      : `${nomePrato} — Venha provar!`,
    cta: ctas[objetivo] || ctas["atrair clientes em dia fraco"],
    legenda: objetivoLegendas[objetivo] || objetivoLegendas["atrair clientes em dia fraco"],
    hashtags: allHashtags,
    elementosVisuais,
    storyVariacao,
  };
}

// ─── Copyable Block Component ────────────────────────────────────
function CopyBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(`${label} copiado!`);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-muted/80 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title={`Copiar ${label}`}
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── Gallery Component ──────────────────────────────────────────
function GalleryTab({
  restaurantId,
  onReuse,
}: {
  restaurantId: string | undefined;
  onReuse: (asset: PromotionAsset) => void;
}) {
  const [assets, setAssets] = useState<PromotionAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterGoal, setFilterGoal] = useState<string>("all");
  const [filterAudience, setFilterAudience] = useState<string>("all");

  const fetchAssets = async () => {
    if (!restaurantId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("promotions_assets" as any)
      .select("*")
      .eq("restaurant_id", restaurantId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setAssets(data as any as PromotionAsset[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAssets();
  }, [restaurantId]);

  const handleDownload = (imageUrl: string, dishName: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `promo-${dishName.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.target = "_blank";
    link.click();
    toast.success("Download iniciado!");
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("promotions_assets" as any)
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Erro ao excluir.");
    } else {
      setAssets((prev) => prev.filter((a) => a.id !== id));
      toast.success("Campanha excluída!");
    }
  };

  const filtered = assets.filter((a) => {
    if (filterType !== "all" && a.campaign_type !== filterType) return false;
    if (filterGoal !== "all" && a.campaign_goal !== filterGoal) return false;
    if (filterAudience !== "all" && a.target_audience !== filterAudience) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Carregando galeria...</p>
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
          <Images className="w-7 h-7 text-muted-foreground/50" />
        </div>
        <p className="text-sm text-muted-foreground font-medium mb-1">Nenhuma imagem gerada ainda</p>
        <p className="text-xs text-muted-foreground/70">
          Crie sua primeira campanha na aba <strong>Criar</strong> e ela aparecerá aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border-dashed">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filtros</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="com_desconto">Com desconto</SelectItem>
                <SelectItem value="sem_desconto">Sem desconto</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterGoal} onValueChange={setFilterGoal}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Objetivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os objetivos</SelectItem>
                <SelectItem value="atrair clientes em dia fraco">Atrair clientes</SelectItem>
                <SelectItem value="divulgar novidade">Divulgar novidade</SelectItem>
                <SelectItem value="aumentar ticket médio">Aumentar ticket</SelectItem>
                <SelectItem value="recuperar clientes">Recuperar clientes</SelectItem>
                <SelectItem value="evento especial">Evento especial</SelectItem>
                <SelectItem value="campanha institucional">Institucional</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterAudience} onValueChange={setFilterAudience}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Público" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os públicos</SelectItem>
                <SelectItem value="casal">Casal</SelectItem>
                <SelectItem value="família">Família</SelectItem>
                <SelectItem value="amigos">Amigos</SelectItem>
                <SelectItem value="happy hour">Happy hour</SelectItem>
                <SelectItem value="geral">Geral</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? "campanha" : "campanhas"}
        </p>
        <Button variant="outline" size="sm" onClick={fetchAssets} className="gap-1.5 text-xs">
          <RefreshCw className="w-3 h-3" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((asset) => (
          <Card key={asset.id} className="overflow-hidden group">
            {asset.image_url ? (
              <div className="relative aspect-square bg-muted/20">
                <img
                  src={asset.image_url}
                  alt={asset.dish_name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="aspect-square bg-muted/20 flex items-center justify-center">
                <ImageIcon className="w-10 h-10 text-muted-foreground/30" />
              </div>
            )}
            <CardContent className="p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-foreground truncate">{asset.dish_name}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <Badge
                    variant="outline"
                    className={
                      asset.campaign_type === "com_desconto"
                        ? "text-xs bg-green-500/10 text-green-600 border-green-500/20"
                        : "text-xs bg-blue-500/10 text-blue-600 border-blue-500/20"
                    }
                  >
                    {asset.campaign_type === "com_desconto"
                      ? `${asset.discount_percent}% OFF`
                      : "Sem desconto"}
                  </Badge>
                  {asset.campaign_goal && (
                    <Badge variant="secondary" className="text-[10px]">
                      {asset.campaign_goal}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                <Calendar className="w-3 h-3" />
                {format(new Date(asset.created_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
              </div>
              <div className="flex gap-2">
                {asset.image_url && (
                  <Button
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => handleDownload(asset.image_url!, asset.dish_name)}
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar Imagem
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => onReuse(asset)}
                  title="Reutilizar dados"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(asset.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────
export default function IACreatorMarketing() {
  const { restaurant } = useRestaurant();
  const navigate = useNavigate();
  const [form, setForm] = useState<CampaignForm>({
    nomePrato: "",
    fraseRestaurante: "",
    precoOriginal: "",
    precoPromocional: "",
    desconto: "",
    objetivo: "",
    diaSemana: "",
    publicoAlvo: "",
    tomVoz: "",
    hasDiscount: false,
    includeLogo: false,
    includeAddress: false,
  });
  const [result, setResult] = useState<GeneratedContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showForm, setShowForm] = useState(true);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [referenceFileName, setReferenceFileName] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("criar");

  // Editable text overrides — restaurant can customize before image generation
  const [editableHeadline, setEditableHeadline] = useState("");
  const [editableSubheadline, setEditableSubheadline] = useState("");
  const [editableCta, setEditableCta] = useState("");
  const [editableLegenda, setEditableLegenda] = useState("");
  const [textConfirmed, setTextConfirmed] = useState(false);

  const hasLogo = !!restaurant?.image_url;
  const hasAddress = !!(restaurant?.address_line);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem muito grande. Máximo 5MB.");
      return;
    }
    setReferenceFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeReferenceImage = () => {
    setReferenceImage(null);
    setReferenceFileName(null);
  };

  const update = (field: keyof CampaignForm, value: string | boolean) =>
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if ((field === "precoOriginal" || field === "precoPromocional") && next.precoOriginal && next.precoPromocional) {
        const orig = parseFloat(next.precoOriginal);
        const promo = parseFloat(next.precoPromocional);
        if (orig > 0 && promo > 0 && promo < orig) {
          next.desconto = Math.round(((orig - promo) / orig) * 100).toString();
        }
      }
      return next;
    });

  const canGenerate = form.nomePrato && form.objetivo && form.diaSemana && form.publicoAlvo && form.tomVoz &&
    (!form.hasDiscount || (form.precoOriginal && form.precoPromocional));

  const handleReuse = (asset: PromotionAsset) => {
    setForm({
      nomePrato: asset.dish_name,
      fraseRestaurante: "",
      precoOriginal: asset.original_price?.toString() || "",
      precoPromocional: asset.promo_price?.toString() || "",
      desconto: asset.discount_percent?.toString() || "",
      objetivo: asset.campaign_goal || "",
      diaSemana: asset.campaign_day || "",
      publicoAlvo: asset.target_audience || "",
      tomVoz: asset.brand_tone || "",
      hasDiscount: asset.campaign_type === "com_desconto",
      includeLogo: asset.include_logo,
      includeAddress: asset.include_address,
    });
    setActiveTab("criar");
    toast.success("Dados preenchidos! Ajuste e gere novamente.");
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedImage(null);
    setTextConfirmed(false);
    await new Promise((r) => setTimeout(r, 600));
    const content = generateContent(
      form,
      restaurant?.name || "Restaurante",
      (restaurant as any)?.cuisine || "Gastronomia",
      (restaurant as any)?.city || "São Paulo"
    );
    setResult(content);
    // Populate editable fields with generated text
    setEditableHeadline(content.headline);
    setEditableSubheadline(content.subheadline);
    setEditableCta(content.cta);
    setEditableLegenda(content.legenda);
    setIsGenerating(false);
    setShowForm(false);
    toast.success("Conteúdo gerado! Edite os textos e clique em Gerar Imagem.");
  };

  const generatePromoImage = async () => {
    setIsGeneratingImage(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();

      const body: any = {
        restaurantName: restaurant?.name || "Restaurante",
        cuisineType: (restaurant as any)?.cuisine || "Gastronomia",
        dishName: form.nomePrato,
        restaurantPhrase: form.fraseRestaurante || undefined,
        targetAudience: form.publicoAlvo,
        brandTone: form.tomVoz,
        campaignDay: form.diaSemana,
        objective: form.objetivo,
        hasDiscount: form.hasDiscount,
        includeLogo: form.includeLogo && hasLogo,
        includeAddress: form.includeAddress && hasAddress,
        logoUrl: form.includeLogo && hasLogo ? restaurant?.image_url : undefined,
        address: form.includeAddress && hasAddress ? restaurant?.address_line : undefined,
        referenceImage: referenceImage || undefined,
        restaurantId: restaurant?.id || undefined,
        userId: user?.id || undefined,
      };

      if (form.hasDiscount) {
        body.originalPrice = form.precoOriginal;
        body.promoPrice = form.precoPromocional;
        body.discount = form.desconto;
      }

      const { data, error } = await supabase.functions.invoke("generate-promo-image", { body });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.imageUrl) {
        setGeneratedImage(data.imageUrl);
        toast.success("Imagem promocional gerada e salva!");
      } else {
        toast.error("Não foi possível gerar a imagem.");
      }
    } catch (err: any) {
      console.error("Image generation error:", err);
      toast.error(err.message || "Erro ao gerar imagem promocional.");
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleDownloadImage = () => {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = `promo-${form.nomePrato.replace(/\s+/g, "-").toLowerCase()}.png`;
    link.target = "_blank";
    link.click();
    toast.success("Download iniciado!");
  };

  const handleCopyAll = () => {
    if (!result) return;
    const fullText = `📌 HEADLINE:\n${result.headline}\n\n📝 SUBHEADLINE:\n${result.subheadline}\n\n💰 PREÇO:\n${result.precoDestaque}\n\n🎯 CTA:\n${result.cta}\n\n📱 LEGENDA INSTAGRAM:\n${result.legenda}\n\n# HASHTAGS:\n${result.hashtags.join(" ")}\n\n🎨 ELEMENTOS VISUAIS:\n${result.elementosVisuais.join("\n")}\n\n${result.storyVariacao}`;
    navigator.clipboard.writeText(fullText);
    toast.success("Todo o conteúdo copiado!");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 border-b">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.08),transparent_70%)]" />
        <div className="relative max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                MESACLIK <span className="text-primary">Studio</span>
              </h1>
              <p className="text-xs text-muted-foreground uppercase tracking-widest">Marketing</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground max-w-xl mt-1">
            Crie posts profissionais para Instagram — com ou sem desconto. Promoções, divulgações, eventos e campanhas institucionais.
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="criar" className="gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> Criar
            </TabsTrigger>
            <TabsTrigger value="galeria" className="gap-1.5">
              <Images className="w-3.5 h-3.5" /> Galeria
            </TabsTrigger>
          </TabsList>

          {/* ── TAB: CRIAR ────────────────────────────── */}
          <TabsContent value="criar">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              {/* ── LEFT: Form ────────────────────────────── */}
              <div className="lg:col-span-2 space-y-4">
                <div
                  className="flex items-center justify-between cursor-pointer lg:cursor-default"
                  onClick={() => setShowForm((v) => !v)}
                >
                  <h2 className="text-base font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    Dados da Campanha
                  </h2>
                  <span className="lg:hidden">
                    {showForm ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </div>

                <div className={showForm ? "space-y-4" : "hidden lg:block lg:space-y-4"}>
                  <Card className="border-dashed">
                    <CardContent className="p-4 space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="prato" className="text-xs">Nome do Prato / Item</Label>
                        <Input id="prato" placeholder="Ex: Risoto de Camarão" value={form.nomePrato} onChange={(e) => update("nomePrato", e.target.value)} />
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="frase" className="text-xs">Frase do Restaurante <span className="text-muted-foreground">(opcional)</span></Label>
                        <Input
                          id="frase"
                          placeholder='Ex: "Venha ser feliz", "Sabor que conecta"'
                          value={form.fraseRestaurante}
                          onChange={(e) => update("fraseRestaurante", e.target.value)}
                        />
                        <p className="text-[10px] text-muted-foreground">
                          A IA vai integrar essa frase de forma premium na arte gerada.
                        </p>
                      </div>

                      {/* Discount Toggle */}
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                        <div className="flex items-center gap-2">
                          <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                          <Label className="text-xs font-medium cursor-pointer">Esta campanha terá desconto</Label>
                        </div>
                        <Switch
                          checked={form.hasDiscount}
                          onCheckedChange={(v) => update("hasDiscount", v)}
                        />
                      </div>

                      {form.hasDiscount && (
                        <>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs">Preço Original (R$)</Label>
                              <Input type="number" placeholder="89.90" value={form.precoOriginal} onChange={(e) => update("precoOriginal", e.target.value)} />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-xs">Preço Promocional (R$)</Label>
                              <Input type="number" placeholder="59.90" value={form.precoPromocional} onChange={(e) => update("precoPromocional", e.target.value)} />
                            </div>
                          </div>
                          {form.desconto && (
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                                {form.desconto}% OFF
                              </Badge>
                              <span className="text-xs text-muted-foreground">calculado automaticamente</span>
                            </div>
                          )}
                        </>
                      )}

                      <Separator />

                      <div className="space-y-1.5">
                        <Label className="text-xs">Objetivo da Campanha</Label>
                        <Select value={form.objetivo} onValueChange={(v) => update("objetivo", v)}>
                          <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="atrair clientes em dia fraco">Atrair clientes em dia fraco</SelectItem>
                            <SelectItem value="divulgar novidade">Divulgar novidade</SelectItem>
                            <SelectItem value="aumentar ticket médio">Aumentar ticket médio</SelectItem>
                            <SelectItem value="recuperar clientes">Recuperar clientes</SelectItem>
                            <SelectItem value="evento especial">Evento especial</SelectItem>
                            <SelectItem value="campanha institucional">Campanha institucional</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Dia da Campanha</Label>
                          <Select value={form.diaSemana} onValueChange={(v) => update("diaSemana", v)}>
                            <SelectTrigger><SelectValue placeholder="Dia..." /></SelectTrigger>
                            <SelectContent>
                              {["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"].map((d) => (
                                <SelectItem key={d} value={d}>{d}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Público-alvo</Label>
                          <Select value={form.publicoAlvo} onValueChange={(v) => update("publicoAlvo", v)}>
                            <SelectTrigger><SelectValue placeholder="Público..." /></SelectTrigger>
                            <SelectContent>
                              {["casal", "família", "amigos", "happy hour", "geral"].map((p) => (
                                <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs">Tom de Voz da Marca</Label>
                        <Select value={form.tomVoz} onValueChange={(v) => update("tomVoz", v)}>
                          <SelectTrigger><SelectValue placeholder="Selecione o tom..." /></SelectTrigger>
                          <SelectContent>
                            {["sofisticado", "divertido", "familiar", "jovem", "tradicional"].map((t) => (
                              <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Logo & Address toggles */}
                  <Card className="border-dashed">
                    <CardContent className="p-4 space-y-4">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Personalização da arte</p>

                      {/* Logo toggle */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <ImageIcon className="w-4 h-4 text-muted-foreground" />
                            <Label className="text-xs cursor-pointer">Exibir logo na arte</Label>
                          </div>
                          <Switch
                            checked={form.includeLogo}
                            onCheckedChange={(v) => update("includeLogo", v)}
                          />
                        </div>
                        {form.includeLogo && !hasLogo && (
                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              Para exibir a logo na arte, anexe a logo em Configurações.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1.5"
                              onClick={() => navigate("/settings")}
                            >
                              <Settings className="w-3 h-3" /> Ir para Configurações
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Address toggle */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                            <Label className="text-xs cursor-pointer">Exibir endereço no rodapé</Label>
                          </div>
                          <Switch
                            checked={form.includeAddress}
                            onCheckedChange={(v) => update("includeAddress", v)}
                          />
                        </div>
                        {form.includeAddress && !hasAddress && (
                          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                              Para exibir o endereço, preencha o endereço em Configurações.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs gap-1.5"
                              onClick={() => navigate("/settings")}
                            >
                              <Settings className="w-3 h-3" /> Ir para Configurações
                            </Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Reference Image Upload */}
                  <Card className="border-dashed">
                    <CardContent className="p-4 space-y-3">
                      <Label className="text-xs font-medium flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5" /> Imagem de referência (opcional)
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Anexe uma foto do prato ou do ambiente. A IA usará como base para criar a arte.
                      </p>

                      {referenceImage ? (
                        <div className="relative">
                          <img
                            src={referenceImage}
                            alt="Referência"
                            className="w-full h-40 object-cover rounded-lg border"
                          />
                          <button
                            onClick={removeReferenceImage}
                            className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background text-foreground border shadow-sm"
                          >
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                          <p className="text-xs text-muted-foreground mt-1.5 truncate">{referenceFileName}</p>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center gap-2 py-6 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
                          <Upload className="w-5 h-5 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Clique para anexar uma imagem</span>
                          <span className="text-[10px] text-muted-foreground/60">JPG, PNG — máx 5MB</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            onChange={handleImageUpload}
                          />
                        </label>
                      )}
                    </CardContent>
                  </Card>

                  <Button
                    onClick={handleGenerate}
                    disabled={!canGenerate || isGenerating}
                    className="w-full gap-2 h-11"
                    size="lg"
                  >
                    <Sparkles className="w-4 h-4" />
                    {isGenerating ? "Gerando conteúdo..." : "Gerar Campanha"}
                  </Button>
                </div>
              </div>

              {/* ── RIGHT: Generated Content ──────────────── */}
              <div className="lg:col-span-3 space-y-5">
                {!result ? (
                  <div className="flex flex-col items-center justify-center py-24 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <Instagram className="w-7 h-7 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Preencha os dados da campanha e clique em <strong>Gerar</strong> para criar seu post.
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h2 className="text-base font-semibold flex items-center gap-2">
                        <Instagram className="w-4 h-4 text-primary" />
                        Conteúdo Gerado
                      </h2>
                      <Button variant="outline" size="sm" onClick={handleCopyAll} className="gap-1.5 text-xs">
                        <Copy className="w-3.5 h-3.5" /> Copiar tudo
                      </Button>
                    </div>

                    {/* AI Generated Image */}
                    <Card className="relative overflow-hidden">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5" /> Imagem Promocional IA
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {isGeneratingImage ? (
                          <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">Gerando imagem promocional com IA...</p>
                            <p className="text-xs text-muted-foreground/60">Isso pode levar alguns segundos</p>
                          </div>
                        ) : generatedImage ? (
                          <div className="space-y-3">
                            <div className="rounded-lg overflow-hidden border bg-muted/20">
                              <img
                                src={generatedImage}
                                alt={`Promoção ${form.nomePrato}`}
                                className="w-full h-auto object-contain"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={handleDownloadImage} size="sm" className="gap-1.5 flex-1">
                                <Download className="w-3.5 h-3.5" /> Baixar Imagem
                              </Button>
                              <Button onClick={generatePromoImage} variant="outline" size="sm" className="gap-1.5">
                                <Sparkles className="w-3.5 h-3.5" /> Regenerar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-10 gap-2">
                            <ImageIcon className="w-8 h-8 text-muted-foreground/30" />
                            <p className="text-xs text-muted-foreground">Imagem não disponível</p>
                            <Button onClick={generatePromoImage} variant="outline" size="sm" className="gap-1.5 mt-1">
                              <Sparkles className="w-3.5 h-3.5" /> Gerar Imagem
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Headline */}
                    <Card className="relative group">
                      <CopyBlock text={result.headline} label="Headline" />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Lightbulb className="w-3.5 h-3.5" /> Headline
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-lg font-bold text-foreground leading-tight">{result.headline}</p>
                      </CardContent>
                    </Card>

                    {/* Subheadline */}
                    <Card className="relative group">
                      <CopyBlock text={result.subheadline} label="Subheadline" />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5" /> Subheadline
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-foreground/90">{result.subheadline}</p>
                      </CardContent>
                    </Card>

                    {/* Preço + CTA */}
                    <div className={`grid grid-cols-1 ${form.hasDiscount ? "sm:grid-cols-2" : ""} gap-4`}>
                      {form.hasDiscount && (
                        <Card className="relative bg-green-500/5 border-green-500/20">
                          <CopyBlock text={`De R$ ${form.precoOriginal} por R$ ${form.precoPromocional} (${form.desconto}% OFF)`} label="Preço" />
                          <CardHeader className="pb-2">
                            <CardTitle className="text-xs uppercase tracking-wider text-green-600 flex items-center gap-1.5">
                              💰 Preço Destaque
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-xs text-muted-foreground line-through">R$ {form.precoOriginal}</p>
                            <p className="text-2xl font-black text-green-600">R$ {form.precoPromocional}</p>
                            <Badge className="mt-1 bg-green-500 text-white text-xs">{form.desconto}% OFF</Badge>
                          </CardContent>
                        </Card>
                      )}

                      <Card className="relative bg-primary/5 border-primary/20">
                        <CopyBlock text={result.cta} label="CTA" />
                        <CardHeader className="pb-2">
                          <CardTitle className="text-xs uppercase tracking-wider text-primary flex items-center gap-1.5">
                            <Target className="w-3.5 h-3.5" /> CTA
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm font-semibold text-foreground">{result.cta}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Legenda */}
                    <Card className="relative">
                      <CopyBlock text={result.legenda} label="Legenda" />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Instagram className="w-3.5 h-3.5" /> Legenda Instagram
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-line">{result.legenda}</p>
                      </CardContent>
                    </Card>

                    {/* Hashtags */}
                    <Card className="relative">
                      <CopyBlock text={result.hashtags.join(" ")} label="Hashtags" />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Hash className="w-3.5 h-3.5" /> Hashtags
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {result.hashtags.map((tag) => (
                            <Badge key={tag} variant="outline" className="text-xs font-mono">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Visual Elements */}
                    <Card className="relative">
                      <CopyBlock text={result.elementosVisuais.join("\n")} label="Elementos Visuais" />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Palette className="w-3.5 h-3.5" /> Elementos Visuais
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1.5">
                          {result.elementosVisuais.map((el, i) => (
                            <li key={i} className="text-sm text-foreground/80">{el}</li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>

                    {/* Story Variation */}
                    <Card className="relative">
                      <CopyBlock text={result.storyVariacao} label="Story" />
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                          <Smartphone className="w-3.5 h-3.5" /> Variação para Story
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-foreground/85 whitespace-pre-line leading-relaxed">{result.storyVariacao}</p>
                      </CardContent>
                    </Card>

                    {/* Regenerate */}
                    <Button
                      onClick={handleGenerate}
                      variant="outline"
                      className="w-full gap-2"
                      disabled={isGenerating}
                    >
                      <Sparkles className="w-4 h-4" />
                      {isGenerating ? "Regenerando..." : "Gerar nova variação"}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── TAB: GALERIA ──────────────────────────── */}
          <TabsContent value="galeria">
            <GalleryTab restaurantId={restaurant?.id} onReuse={handleReuse} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
