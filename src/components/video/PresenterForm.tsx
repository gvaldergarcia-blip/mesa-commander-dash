import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Plus,
  Trash2,
  Mic,
  Play,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useVideoGenerator } from "@/hooks/useVideoGenerator";
import { renderPresenterVideo, type PresenterRenderOptions } from "@/lib/video/presenterRenderer";
import { toast } from "sonner";

const TONES = [
  { value: "sofisticado", label: "Sofisticado", emoji: "🍷" },
  { value: "jovem", label: "Jovem", emoji: "🔥" },
  { value: "familiar", label: "Familiar", emoji: "🏠" },
  { value: "gourmet", label: "Gourmet", emoji: "🍽️" },
];

const DURATIONS = [
  { value: 15, label: "15s", desc: "Stories" },
  { value: 30, label: "30s", desc: "Reels" },
  { value: 45, label: "45s", desc: "Premium" },
];

export default function PresenterForm() {
  const { restaurantName, usage } = useVideoGenerator();

  const [form, setForm] = useState({
    restaurantName: restaurantName || "",
    dishName: "",
    promotion: "",
    freeText: "",
    tone: "sofisticado",
    duration: 30 as 15 | 30 | 45,
  });

  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [script, setScript] = useState<{ tag: string; text: string }[] | null>(null);
  const [fullScript, setFullScript] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + images.length > 5) {
      toast.error("Máximo de 5 imagens");
      return;
    }
    const newImages = [...images, ...files].slice(0, 5);
    setImages(newImages);
    setImagePreviews((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return newImages.map((f) => URL.createObjectURL(f));
    });
  };

  const removeImage = (idx: number) => {
    URL.revokeObjectURL(imagePreviews[idx]);
    setImages((prev) => prev.filter((_, i) => i !== idx));
    setImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  const generateScript = async () => {
    if (!form.dishName.trim()) {
      toast.error("Informe o nome do prato");
      return;
    }

    setIsGeneratingScript(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-video-script", {
        body: {
          restaurantName: form.restaurantName || restaurantName || "Restaurante",
          dishName: form.dishName,
          promotion: form.promotion || undefined,
          freeText: form.freeText || undefined,
          tone: form.tone,
          duration: form.duration,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setScript(data.sections || []);
      setFullScript(data.script || "");
      toast.success("Roteiro gerado com sucesso!");
    } catch (err) {
      console.error("Script generation error:", err);
      toast.error(err instanceof Error ? err.message : "Erro ao gerar roteiro");
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const renderVideo = async () => {
    if (!script || script.length === 0) {
      toast.error("Gere o roteiro antes de renderizar");
      return;
    }

    setIsRendering(true);
    setRenderProgress(0);
    setGeneratedVideoUrl(null);

    try {
      // Upload images first
      const imageUrls: string[] = [];
      for (const file of images) {
        const ext = file.name.split(".").pop();
        const fileName = `presenter/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data, error } = await supabase.storage
          .from("marketing-videos")
          .upload(fileName, file, { cacheControl: "3600" });
        if (error) throw error;
        const { data: pub } = supabase.storage.from("marketing-videos").getPublicUrl(data.path);
        imageUrls.push(pub.publicUrl);
      }

      const opts: PresenterRenderOptions = {
        sections: script,
        fullScript,
        restaurantName: form.restaurantName || restaurantName || "Restaurante",
        dishName: form.dishName,
        tone: form.tone,
        duration: form.duration,
        images: imageUrls,
        onProgress: setRenderProgress,
      };

      const blob = await renderPresenterVideo(opts);

      // Upload video
      const videoName = `presenter/videos/${Date.now()}_presenter_${form.duration}s.webm`;
      const { data: videoData, error: uploadErr } = await supabase.storage
        .from("marketing-videos")
        .upload(videoName, blob, { contentType: "video/webm", cacheControl: "3600" });

      if (uploadErr) throw uploadErr;

      const { data: videoUrl } = supabase.storage
        .from("marketing-videos")
        .getPublicUrl(videoData.path);

      setGeneratedVideoUrl(videoUrl.publicUrl);
      toast.success("Vídeo IA Apresentador gerado com sucesso!");
    } catch (err) {
      console.error("Render error:", err);
      toast.error(err instanceof Error ? err.message : "Erro na renderização");
    } finally {
      setIsRendering(false);
      setRenderProgress(0);
    }
  };

  const isBusy = isGeneratingScript || isRendering;

  return (
    <div className="space-y-5">
      {/* Form Fields */}
      <div className="grid gap-5 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mic className="h-4 w-4 text-primary" />
              Dados do Vídeo
            </CardTitle>
            <CardDescription className="text-xs">
              A IA criará um roteiro profissional com base nestas informações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Restaurante</Label>
              <Input
                value={form.restaurantName}
                onChange={(e) => setForm((p) => ({ ...p, restaurantName: e.target.value }))}
                placeholder={restaurantName || "Seu restaurante"}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Prato *</Label>
              <Input
                value={form.dishName}
                onChange={(e) => setForm((p) => ({ ...p, dishName: e.target.value }))}
                placeholder="Ex: Risoto de Camarão"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Promoção (opcional)</Label>
              <Input
                value={form.promotion}
                onChange={(e) => setForm((p) => ({ ...p, promotion: e.target.value }))}
                placeholder="Ex: 20% off às terças"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Texto livre (opcional)</Label>
              <Textarea
                value={form.freeText}
                onChange={(e) => setForm((p) => ({ ...p, freeText: e.target.value }))}
                placeholder="Algo especial que queira mencionar..."
                className="min-h-[60px] text-sm"
                maxLength={300}
              />
              <span className="text-[10px] text-muted-foreground float-right">
                {form.freeText.length}/300
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estilo & Duração</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Tone */}
            <div className="space-y-1.5">
              <Label className="text-xs">Tom do Vídeo</Label>
              <div className="grid grid-cols-2 gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setForm((p) => ({ ...p, tone: t.value }))}
                    className={`p-2.5 border rounded-lg transition-all text-center ${
                      form.tone === t.value
                        ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="text-base">{t.emoji}</span>
                    <p className="font-medium text-xs mt-0.5">{t.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Duration */}
            <div className="space-y-1.5">
              <Label className="text-xs">Duração</Label>
              <div className="grid grid-cols-3 gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setForm((p) => ({ ...p, duration: d.value as 15 | 30 | 45 }))}
                    className={`p-2.5 border rounded-lg transition-all text-center ${
                      form.duration === d.value
                        ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <span className="font-bold text-sm">{d.label}</span>
                    <p className="text-[10px] text-muted-foreground">{d.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Images */}
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1">
                <ImageIcon className="h-3 w-3" />
                Imagens do prato
                <Badge variant="secondary" className="ml-auto text-[10px]">{images.length}/5</Badge>
              </Label>
              <div className="flex gap-2 flex-wrap">
                {imagePreviews.map((url, i) => (
                  <div key={url} className="relative w-14 h-14 rounded-lg overflow-hidden group">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button
                      onClick={() => removeImage(i)}
                      className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                    >
                      <Trash2 className="h-3 w-3 text-white" />
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <label className="w-14 h-14 border-2 border-dashed border-muted-foreground/20 rounded-lg flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors">
                    <Plus className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Generate Script Button */}
      <Button
        onClick={generateScript}
        disabled={isBusy || !form.dishName.trim()}
        className="w-full gap-2"
        size="lg"
      >
        {isGeneratingScript ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Gerando roteiro com IA...
          </>
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Gerar Roteiro com IA
          </>
        )}
      </Button>

      {/* Script Preview */}
      {script && script.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Roteiro Gerado
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {script.map((section, i) => (
              <div key={i} className="space-y-1">
                <Badge variant="outline" className="text-[10px]">
                  {section.tag}
                </Badge>
                <p className="text-sm text-foreground/90 leading-relaxed">
                  {section.text}
                </p>
              </div>
            ))}

            {/* Render Button */}
            <Button
              onClick={renderVideo}
              disabled={isBusy}
              className="w-full gap-2 mt-4"
              size="lg"
              variant="default"
            >
              {isRendering ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Renderizando vídeo... {renderProgress}%
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Gerar Vídeo IA Apresentador
                </>
              )}
            </Button>

            {isRendering && (
              <Progress value={renderProgress} className="h-2" />
            )}
          </CardContent>
        </Card>
      )}

      {/* Generated Video */}
      {generatedVideoUrl && (
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">🎬 Vídeo Pronto!</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-lg overflow-hidden bg-black max-w-[300px] mx-auto">
              <video
                src={generatedVideoUrl}
                controls
                className="w-full"
                style={{ aspectRatio: "9/16" }}
              />
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const a = document.createElement("a");
                  a.href = generatedVideoUrl;
                  a.download = `apresentador_${form.dishName}_${form.duration}s.webm`;
                  a.click();
                }}
              >
                Download
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(generatedVideoUrl);
                  toast.success("Link copiado!");
                }}
              >
                Copiar Link
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
