import { useState, useRef, useCallback } from "react";
import html2canvas from "html2canvas";
import {
  Download,
  Smartphone,
  Copy,
  Check,
  RefreshCw,
  Loader2,
  Layout,
  Instagram,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { PostGeneratorForm, type PostFormData } from "@/components/post-generator/PostGeneratorForm";
import { PostLayoutPreview, type CopyData } from "@/components/post-generator/PostLayoutPreview";
import { cn } from "@/lib/utils";

const LAYOUTS = [
  { id: "impacto", label: "Impacto", desc: "Fundo escuro, produto centralizado", emoji: "🌑" },
  { id: "clean", label: "Clean", desc: "Fundo claro, elegante", emoji: "🤍" },
  { id: "urgencia", label: "Urgência", desc: "Cores quentes, energia alta", emoji: "🔥" },
  { id: "minimalista", label: "Minimalista", desc: "Espaço, foco no produto", emoji: "✨" },
];

export default function PostGenerator() {
  const { restaurant, restaurantId, user } = useRestaurant();

  const [form, setForm] = useState<PostFormData>({
    postType: "promocao",
    dishName: "",
    priceOld: "",
    priceNew: "",
    validity: "",
    tone: "divertido",
    imageFile: null,
    imagePreview: null,
  });

  const [copyData, setCopyData] = useState<CopyData | null>(null);
  const [selectedLayout, setSelectedLayout] = useState("impacto");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [captionCopied, setCaptionCopied] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<"feed" | "story">("feed");
  const [step, setStep] = useState<"form" | "preview">("form");

  const previewRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    if (!form.dishName.trim() || !form.imagePreview) {
      toast.error("Preencha o nome do prato e envie uma foto.");
      return;
    }

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-post-copy", {
        body: {
          postType: form.postType,
          dishName: form.dishName,
          priceOld: form.priceOld,
          priceNew: form.priceNew,
          validity: form.validity,
          tone: form.tone,
          restaurantName: restaurant?.name || "Restaurante",
          cuisineType: restaurant?.cuisine || "Gastronomia",
        },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setCopyData(data.copy);
      setStep("preview");
      toast.success("Copy gerado com sucesso!");
    } catch (err: any) {
      console.error("Error generating copy:", err);
      toast.error("Não conseguimos gerar o post. Tente novamente.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditField = useCallback((field: keyof CopyData, value: string) => {
    setCopyData((prev) => (prev ? { ...prev, [field]: value } : prev));
  }, []);

  const handleRegenerate = () => {
    handleGenerate();
  };

  const handleExport = async (format: "feed" | "story") => {
    if (!previewRef.current) return;
    setIsExporting(true);
    setPreviewFormat(format);

    // Wait for format change to render
    await new Promise((r) => setTimeout(r, 200));

    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        width: 1080,
        height: format === "story" ? 1920 : 1080,
      });

      const link = document.createElement("a");
      link.download = `post-${form.dishName.replace(/\s+/g, "-").toLowerCase()}-${format}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success(`Post ${format === "feed" ? "1080×1080" : "1080×1920"} exportado!`);

      // Save to database
      if (restaurantId) {
        await supabase.from("generated_posts" as any).insert({
          restaurant_id: restaurantId,
          post_type: form.postType,
          layout: selectedLayout,
          copy_data: copyData,
          image_upload_url: form.imagePreview,
          dish_name: form.dishName,
          tone: form.tone,
          validity: form.validity,
          price_old: form.priceOld ? parseFloat(form.priceOld) : null,
          price_new: form.priceNew ? parseFloat(form.priceNew) : null,
          discount_percent: copyData?.discount
            ? parseInt(copyData.discount.replace(/[^\d]/g, "")) || null
            : null,
        });
      }
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Erro ao exportar. Tente novamente.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyCaption = () => {
    if (!copyData?.caption) return;
    navigator.clipboard.writeText(copyData.caption);
    setCaptionCopied(true);
    toast.success("Legenda copiada!");
    setTimeout(() => setCaptionCopied(false), 2000);
  };

  if (!copyData || step === "form") {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">Gerador de Posts</h1>
            <Badge variant="secondary" className="text-xs gap-1">
              <Instagram className="w-3 h-3" /> Instagram
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Crie posts profissionais para seu restaurante com IA
          </p>
        </div>

        <PostGeneratorForm
          form={form}
          setForm={setForm}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">Gerador de Posts</h1>
            <Badge variant="secondary" className="text-xs gap-1">
              <Instagram className="w-3 h-3" /> Instagram
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">Edite, escolha um layout e exporte</p>
        </div>
        <Button variant="outline" onClick={() => setStep("form")} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Novo post
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
        {/* Preview Area */}
        <div className="space-y-4">
          {/* Layout Selector */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layout className="w-4 h-4" />
                Escolha o layout
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setSelectedLayout(l.id)}
                    className={cn(
                      "p-3 rounded-lg border-2 text-left transition-all",
                      selectedLayout === l.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    <span className="text-2xl">{l.emoji}</span>
                    <p className="text-sm font-semibold mt-1">{l.label}</p>
                    <p className="text-[10px] text-muted-foreground leading-tight">{l.desc}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Format Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant={previewFormat === "feed" ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewFormat("feed")}
            >
              Feed 1:1
            </Button>
            <Button
              variant={previewFormat === "story" ? "default" : "outline"}
              size="sm"
              onClick={() => setPreviewFormat("story")}
              className="gap-1"
            >
              <Smartphone className="w-3 h-3" /> Story 9:16
            </Button>
          </div>

          {/* Visual Preview (scaled down) */}
          <div
            className="relative overflow-hidden rounded-xl border border-border bg-muted/30"
            style={{
              maxWidth: previewFormat === "feed" ? 540 : 304,
              aspectRatio: previewFormat === "feed" ? "1/1" : "9/16",
            }}
          >
            <div
              style={{
                transform: `scale(${previewFormat === "feed" ? 540 / 1080 : 304 / 1080})`,
                transformOrigin: "top left",
                width: 1080,
                height: previewFormat === "feed" ? 1080 : 1920,
              }}
            >
              <PostLayoutPreview
                ref={previewRef}
                layout={selectedLayout}
                copy={copyData}
                imageUrl={form.imagePreview!}
                restaurantName={restaurant?.name || "Restaurante"}
                logoUrl={restaurant?.image_url}
                format={previewFormat}
                onEditField={handleEditField}
              />
            </div>
          </div>
        </div>

        {/* Sidebar: Actions + Caption */}
        <div className="space-y-4">
          {/* Export Actions */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Exportar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button
                className="w-full gap-2"
                onClick={() => handleExport("feed")}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                Baixar Feed (1080×1080)
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => handleExport("story")}
                disabled={isExporting}
              >
                <Smartphone className="w-4 h-4" />
                Baixar Story (1080×1920)
              </Button>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleCopyCaption}
              >
                {captionCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {captionCopied ? "Copiada!" : "Copiar legenda"}
              </Button>
            </CardContent>
          </Card>

          {/* Caption Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Legenda gerada</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {copyData.caption}
              </p>
              {copyData.hashtags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {copyData.hashtags.map((h, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      #{h.replace(/^#/, "")}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Regenerate */}
          <Button
            variant="ghost"
            className="w-full gap-2 text-muted-foreground"
            onClick={handleRegenerate}
            disabled={isGenerating}
          >
            {isGenerating ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Regerar copy com IA
          </Button>
        </div>
      </div>
    </div>
  );
}
