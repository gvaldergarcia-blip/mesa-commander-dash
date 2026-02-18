import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Video,
  Upload,
  Plus,
  Trash2,
  Download,
  Copy,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Image as ImageIcon,
  Sparkles,
  Film,
  Music,
  FileText,
} from "lucide-react";
import { useVideoGenerator, type VideoJob, type CreateVideoParams } from "@/hooks/useVideoGenerator";
import { useRestaurant } from "@/contexts/RestaurantContext";
import { LivePreview } from "@/components/video/LivePreview";
import { SlideshowPreview } from "@/components/video/SlideshowPreview";
import { VoiceDictateButton } from "@/components/video/VoiceDictateButton";
import { VoiceChatPanel } from "@/components/video/VoiceChatPanel";
import { useVoiceChat } from "@/hooks/useVoiceChat";
import { getTemplateList } from "@/lib/video/videoRenderer";
import { resolveTheme, type MusicTheme } from "@/lib/video/audioGenerator";
import { generateScript, type VideoScript } from "@/lib/video/scriptGenerator";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TEMPLATES = getTemplateList();

const CTA_OPTIONS = [
  { value: "Reserve agora", label: "Reserve agora" },
  { value: "Entre na fila", label: "Entre na fila" },
  { value: "Chame no WhatsApp", label: "Chame no WhatsApp" },
  { value: "Veja o cardápio", label: "Veja o cardápio" },
];

export default function VideoGenerator() {
  const {
    videoJobs,
    isLoadingJobs,
    usage,
    uploadProgress,
    renderProgress,
    isRendering,
    createVideo,
    isCreating,
    deleteVideo,
    isDeleting,
    restaurantName,
  } = useVideoGenerator();

  const { restaurant } = useRestaurant();

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<VideoJob | null>(null);
  const [voicePanelOpen, setVoicePanelOpen] = useState(false);
  const [scriptPreview, setScriptPreview] = useState<VideoScript | null>(null);
  const [showScriptDialog, setShowScriptDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    headline: "",
    subtext: "",
    format: "vertical" as "vertical" | "square",
    duration: 15 as 7 | 15 | 30,
    templateId: "elegante",
    cta: "",
    musicTheme: "auto" as MusicTheme,
  });

  const handleFormUpdate = useCallback((updates: Partial<typeof formData>) => {
    setFormData((p) => ({ ...p, ...updates }));
  }, []);

  const voiceChat = useVoiceChat(formData, handleFormUpdate);

  const isBusy = isCreating || isRendering;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + selectedImages.length > 8) {
      toast.error("Máximo de 8 imagens");
      return;
    }
    const newImages = [...selectedImages, ...files].slice(0, 8);
    setSelectedImages(newImages);
    const newPreviews = newImages.map((file) => URL.createObjectURL(file));
    setImagePreviewUrls((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return newPreviews;
    });
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    URL.revokeObjectURL(imagePreviewUrls[index]);
    setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= selectedImages.length) return;
    const newImages = [...selectedImages];
    const [moved] = newImages.splice(from, 1);
    newImages.splice(to, 0, moved);
    setSelectedImages(newImages);
    const newPreviews = [...imagePreviewUrls];
    const [movedP] = newPreviews.splice(from, 1);
    newPreviews.splice(to, 0, movedP);
    setImagePreviewUrls(newPreviews);
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = () => {
    if (!formData.headline.trim()) {
      toast.error("Informe o título (headline)");
      return;
    }
    if (formData.headline.length > 40) {
      toast.error("Headline deve ter no máximo 40 caracteres");
      return;
    }
    if (formData.subtext && formData.subtext.length > 90) {
      toast.error("Subtexto deve ter no máximo 90 caracteres");
      return;
    }
    if (selectedImages.length < 3) {
      toast.error("Selecione pelo menos 3 imagens");
      return;
    }

    // Generate and show script preview
    const script = generateScript({
      headline: formData.headline.trim(),
      subtext: formData.subtext.trim() || undefined,
      cta: formData.cta || undefined,
      restaurantName: restaurantName || "Restaurante",
      duration: formData.duration,
    });
    setScriptPreview(script);
    setShowScriptDialog(true);
  };

  const handleConfirmGenerate = () => {
    setShowScriptDialog(false);

    const resolvedMusicTheme = resolveTheme(formData.musicTheme, restaurant?.cuisine);

    const params: CreateVideoParams = {
      headline: formData.headline.trim(),
      subtext: formData.subtext.trim() || undefined,
      cta: formData.cta || undefined,
      format: formData.format,
      duration: formData.duration,
      templateId: formData.templateId,
      musicTheme: resolvedMusicTheme,
      imageFiles: selectedImages,
      logoFile: logoFile || undefined,
      restaurantName: restaurantName || "Restaurante",
    };

    createVideo(params, {
      onSuccess: () => {
        setSelectedImages([]);
        setImagePreviewUrls([]);
        setLogoFile(null);
        setLogoPreview(null);
        setScriptPreview(null);
        setFormData({
          headline: "",
          subtext: "",
          format: "vertical",
          duration: 15,
          templateId: "elegante",
          cta: "",
          musicTheme: "auto",
        });
      },
    });
  };

  const copyVideoLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const getStatusBadge = (status: VideoJob["status"]) => {
    switch (status) {
      case "queued":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Na fila</Badge>;
      case "processing":
        return <Badge className="gap-1 bg-primary"><Loader2 className="h-3 w-3 animate-spin" /> Gerando</Badge>;
      case "done":
        return <Badge className="gap-1 bg-primary/80"><CheckCircle className="h-3 w-3" /> Pronto</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Falhou</Badge>;
    }
  };

  const overallProgress = isBusy
    ? uploadProgress > 0 && renderProgress === 0
      ? uploadProgress * 0.3
      : 30 + renderProgress * 0.7
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Film className="h-5 w-5 text-primary" />
            </div>
            Marketing IA — Vídeo Premium
          </h1>
          <p className="text-muted-foreground mt-1">
            Gere vídeos cinematográficos para Reels e Stories em segundos
          </p>
        </div>
      </div>

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="create" className="gap-2">
            <Sparkles className="h-4 w-4" /> Slideshow
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Video className="h-4 w-4" /> Meus Vídeos
          </TabsTrigger>
        </TabsList>

        {/* ─── CREATE TAB ─── */}
        <TabsContent value="create" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-[1fr,380px]">
            {/* Left: Form */}
            <div className="space-y-5">
              {/* Images */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <ImageIcon className="h-4 w-4 text-primary" />
                    Imagens do Vídeo
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {selectedImages.length}/8
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Envie de 3 a 8 fotos. Pratos, ambiente, fachada — o que quiser destacar.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    {imagePreviewUrls.map((url, index) => (
                      <div
                        key={url}
                        className="relative rounded-lg overflow-hidden bg-muted aspect-square group border-2 border-transparent hover:border-primary/40 transition-all"
                      >
                        <img src={url} alt={`${index + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 bg-destructive/90 text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-0.5 left-0.5 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => moveImage(index, index - 1)}
                            disabled={index === 0}
                            className="bg-black/70 text-white text-[10px] px-1 py-0.5 rounded disabled:opacity-30"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => moveImage(index, index + 1)}
                            disabled={index === selectedImages.length - 1}
                            className="bg-black/70 text-white text-[10px] px-1 py-0.5 rounded disabled:opacity-30"
                          >
                            →
                          </button>
                        </div>
                        <span className="absolute bottom-0.5 right-0.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">
                          {index + 1}
                        </span>
                      </div>
                    ))}
                    {selectedImages.length < 8 && (
                      <label className="rounded-lg border-2 border-dashed border-muted-foreground/20 aspect-square flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                        <Plus className="h-5 w-5 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">Adicionar</span>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  {selectedImages.length > 0 && selectedImages.length < 3 && (
                    <p className="text-xs text-amber-500 mt-2">
                      Adicione mais {3 - selectedImages.length} imagem(ns) para habilitar a geração
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Texts + Settings */}
              <div className="grid gap-5 sm:grid-cols-2">
                {/* Texts */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Textos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="headline" className="text-xs">Headline * <span className="text-muted-foreground">(máx 40)</span></Label>
                      <div className="flex items-center gap-1">
                        <Input
                          id="headline"
                          placeholder="Ex: Sabor que marca presença"
                          value={formData.headline}
                          maxLength={40}
                          onChange={(e) => setFormData((p) => ({ ...p, headline: e.target.value }))}
                          className="h-9"
                        />
                        <VoiceDictateButton
                          onResult={(text) => setFormData((p) => ({ ...p, headline: (p.headline + " " + text).trim().slice(0, 40) }))}
                        />
                      </div>
                      <div className="flex justify-end">
                        <span className={`text-[10px] ${formData.headline.length > 35 ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {formData.headline.length}/40
                        </span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="subtext" className="text-xs">Subtexto <span className="text-muted-foreground">(máx 90)</span></Label>
                      <div className="flex items-center gap-1">
                        <Input
                          id="subtext"
                          placeholder="Ex: Happy Hour terça a sexta"
                          value={formData.subtext}
                          maxLength={90}
                          onChange={(e) => setFormData((p) => ({ ...p, subtext: e.target.value }))}
                          className="h-9"
                        />
                        <VoiceDictateButton
                          onResult={(text) => setFormData((p) => ({ ...p, subtext: (p.subtext + " " + text).trim().slice(0, 90) }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">CTA Final</Label>
                      <Select
                        value={formData.cta || "none"}
                        onValueChange={(v) => setFormData((p) => ({ ...p, cta: v === "none" ? "" : v }))}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Sem CTA" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sem CTA</SelectItem>
                          {CTA_OPTIONS.map((opt) => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Settings */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Configurações</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Format */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Formato</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: "vertical" as const, label: "Vertical", desc: "9:16" },
                          { value: "square" as const, label: "Quadrado", desc: "1:1" },
                        ].map((f) => (
                          <button
                            key={f.value}
                            onClick={() => setFormData((p) => ({ ...p, format: f.value }))}
                            className={`p-2.5 border rounded-lg transition-all text-center ${
                              formData.format === f.value
                                ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <span className="font-medium text-xs">{f.label}</span>
                            <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Duração</Label>
                      <div className="grid grid-cols-3 gap-2">
                        {([7, 15, 30] as const).map((d) => (
                          <button
                            key={d}
                            onClick={() => setFormData((p) => ({ ...p, duration: d }))}
                            className={`p-2 border rounded-lg transition-all text-center ${
                              formData.duration === d
                                ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                                : "border-border hover:border-primary/40"
                            }`}
                          >
                            <span className="font-medium text-xs">{d}s</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Logo */}
                    <div className="space-y-1.5">
                      <Label className="text-xs">Logo (opcional)</Label>
                      {logoPreview ? (
                        <div className="flex items-center gap-2">
                          <img src={logoPreview} alt="Logo" className="h-10 w-10 object-contain rounded border" />
                          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setLogoFile(null); setLogoPreview(null); }}>
                            <Trash2 className="h-3 w-3 mr-1" /> Remover
                          </Button>
                        </div>
                      ) : (
                        <label className="flex items-center gap-2 p-2.5 border border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all">
                          <Upload className="h-4 w-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Enviar PNG</span>
                          <input type="file" accept="image/png" onChange={handleLogoSelect} className="hidden" />
                        </label>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Template Selection */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Template</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                    {TEMPLATES.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setFormData((p) => ({ ...p, templateId: t.id }))}
                        className={`p-3 border rounded-lg transition-all text-left ${
                          formData.templateId === t.id
                            ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-muted/50"
                        }`}
                      >
                        <div className="text-lg mb-1">{t.emoji}</div>
                        <span className="font-medium text-xs block">{t.name}</span>
                        <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{t.description}</p>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Music Theme Selection */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Music className="h-4 w-4 text-primary" />
                    Tema Musical
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Escolha a trilha sonora de fundo do vídeo
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RadioGroup
                    value={formData.musicTheme}
                    onValueChange={(v) => setFormData((p) => ({ ...p, musicTheme: v as MusicTheme }))}
                    className="grid grid-cols-2 gap-2"
                  >
                    {[
                      { value: "auto", label: "🤖 Automático", desc: "IA escolhe com base na categoria" },
                      { value: "sofisticado", label: "🎹 Sofisticado", desc: "Piano / jazz leve / lounge" },
                      { value: "jovem", label: "🎧 Jovem", desc: "Pop moderno / lo-fi upbeat" },
                      { value: "familiar", label: "🎸 Familiar", desc: "Violão acústico / MPB leve" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer transition-all ${
                          formData.musicTheme === opt.value
                            ? "border-primary bg-primary/10 ring-1 ring-primary shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-muted/50"
                        }`}
                      >
                        <RadioGroupItem value={opt.value} className="mt-0.5" />
                        <div>
                          <span className="font-medium text-xs block">{opt.label}</span>
                          <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </RadioGroup>
                  {formData.musicTheme === "auto" && restaurant?.cuisine && (
                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Categoria "{restaurant.cuisine}" → tema <strong>{resolveTheme("auto", restaurant.cuisine)}</strong>
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Progress */}
              {isBusy && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardContent className="pt-5 pb-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">
                        {uploadProgress > 0 && renderProgress === 0
                          ? "📤 Enviando imagens..."
                          : "🎬 Renderizando vídeo..."}
                      </span>
                      <span className="font-bold text-primary">{Math.round(overallProgress)}%</span>
                    </div>
                    <Progress value={overallProgress} className="h-2" />
                    {isRendering && (
                      <p className="text-xs text-muted-foreground">
                        Gerando frames em alta qualidade. Não feche esta aba.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={isBusy || selectedImages.length < 3 || !formData.headline.trim()}
                className="w-full h-12 text-base gap-2 shadow-lg"
                size="lg"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Gerando vídeo premium...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Gerar Vídeo Premium
                  </>
                )}
              </Button>
              {!isBusy && (selectedImages.length < 3 || !formData.headline.trim()) && (
                <p className="text-xs text-muted-foreground text-center">
                  {selectedImages.length < 3
                    ? `Adicione pelo menos 3 imagens (faltam ${3 - selectedImages.length})`
                    : "Preencha o campo Headline para continuar"}
                </p>
              )}
            </div>

            {/* Right: Live Preview */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                <h3 className="text-sm font-semibold">Preview ao vivo</h3>
              </div>
              <div className="sticky top-4">
                <LivePreview
                  imageUrls={imagePreviewUrls}
                  format={formData.format}
                  duration={formData.duration}
                  templateId={formData.templateId}
                  headline={formData.headline}
                  subtext={formData.subtext || undefined}
                  cta={formData.cta || undefined}
                  restaurantName={restaurantName || "Restaurante"}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ─── HISTORY TAB ─── */}
        <TabsContent value="history">
          {isLoadingJobs ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !videoJobs?.length ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="p-4 rounded-full bg-muted mb-4">
                  <Film className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-medium">Nenhum vídeo criado ainda</h3>
                <p className="text-muted-foreground text-sm mt-1">Crie seu primeiro vídeo premium na aba "Criar Vídeo"</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {videoJobs.map((job) => (
                <Card key={job.id} className="overflow-hidden group hover:shadow-lg transition-shadow">
                  <div className={`bg-muted relative ${job.format === "square" ? "aspect-square" : "aspect-[9/16]"} max-h-64 overflow-hidden`}>
                    {job.thumbnail_url ? (
                      <img src={job.thumbnail_url} alt="Thumb" className="w-full h-full object-cover" />
                    ) : job.image_urls?.[0] ? (
                      <img src={job.image_urls[0]} alt="Preview" className="w-full h-full object-cover opacity-60" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Video className="h-10 w-10 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">{getStatusBadge(job.status)}</div>
                    <div className="absolute bottom-2 left-2 flex gap-1">
                      <Badge variant="secondary" className="text-[10px]">{job.template_id}</Badge>
                      <Badge variant="secondary" className="text-[10px]">{job.duration_seconds}s</Badge>
                      <Badge variant="secondary" className="text-[10px]">{job.format === "vertical" ? "9:16" : "1:1"}</Badge>
                    </div>
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <div>
                      <h4 className="font-medium text-sm truncate">{job.headline}</h4>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(job.created_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    {job.error_message && (
                      <p className="text-[10px] text-destructive">{job.error_message}</p>
                    )}
                    <div className="flex gap-1.5">
                      {job.status === "done" && (
                        <>
                          <Button variant="outline" size="sm" className="flex-1 gap-1 h-8 text-xs" onClick={() => setPreviewVideo(job)}>
                            <Eye className="h-3.5 w-3.5" /> Ver
                          </Button>
                          {job.video_url && (
                            <>
                              <Button variant="outline" size="sm" className="h-8" asChild>
                                <a href={job.video_url} download><Download className="h-3.5 w-3.5" /></a>
                              </Button>
                              <Button variant="outline" size="sm" className="h-8" onClick={() => copyVideoLink(job.video_url!)}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        onClick={() => deleteVideo(job.id)}
                        disabled={isDeleting}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Script Preview Dialog */}
      <Dialog open={showScriptDialog} onOpenChange={setShowScriptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              Roteiro do Vídeo
            </DialogTitle>
          </DialogHeader>
          {scriptPreview && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Confira o roteiro que será exibido no vídeo antes de gerar:
              </p>
              <div className="space-y-2">
                {scriptPreview.segments.map((seg, i) => (
                  <div key={i} className="flex gap-3 items-start p-2.5 rounded-lg bg-muted/50 border">
                    <Badge variant="secondary" className="text-[10px] shrink-0 mt-0.5">
                      {seg.type === 'intro' ? '🎬 Intro' :
                       seg.type === 'headline' ? '📝 Título' :
                       seg.type === 'subtext' ? '💬 Subtexto' :
                       seg.type === 'cta' ? '👆 CTA' : '🎬 Encerramento'}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">{seg.text}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {Math.round(seg.startPercent * formData.duration)}s – {Math.round(seg.endPercent * formData.duration)}s
                      </p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
                <Music className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs">
                  Trilha: <strong>
                    {formData.musicTheme === 'auto'
                      ? `Automático (${resolveTheme('auto', restaurant?.cuisine)})`
                      : formData.musicTheme === 'sofisticado' ? 'Sofisticado'
                      : formData.musicTheme === 'jovem' ? 'Jovem'
                      : 'Familiar'}
                  </strong>
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowScriptDialog(false)}>
                  Voltar e editar
                </Button>
                <Button className="flex-1 gap-1.5" onClick={handleConfirmGenerate} disabled={isBusy}>
                  {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Gerar Vídeo
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Video Preview Dialog */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">{previewVideo?.headline}</DialogTitle>
          </DialogHeader>
          {previewVideo?.video_url ? (
            <video
              src={previewVideo.video_url}
              controls
              autoPlay
              className={`w-full rounded-lg bg-black ${
                previewVideo.format === "square" ? "aspect-square" : "aspect-[9/16]"
              }`}
            />
          ) : previewVideo?.image_urls && previewVideo.image_urls.length > 0 ? (
            <SlideshowPreview
              images={previewVideo.image_urls}
              duration={previewVideo.duration_seconds}
              promoText={previewVideo.subtext || undefined}
              restaurantName={previewVideo.restaurant_name || ""}
            />
          ) : (
            <div className="w-full aspect-[9/16] rounded-lg bg-muted flex items-center justify-center">
              <p className="text-muted-foreground">Sem preview</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Voice Chat FAB */}
      <Button
        variant="default"
        size="lg"
        className="fixed bottom-4 right-4 h-14 w-14 rounded-full p-0 shadow-2xl z-40"
        onClick={() => setVoicePanelOpen((p) => !p)}
      >
        <Film className="h-6 w-6" />
      </Button>

      {/* Voice Chat Panel */}
      <VoiceChatPanel
        isOpen={voicePanelOpen}
        onClose={() => setVoicePanelOpen(false)}
        isSupported={voiceChat.isSupported}
        isListening={voiceChat.isListening}
        isSpeaking={voiceChat.isSpeaking}
        interimText={voiceChat.interimText}
        messages={voiceChat.messages}
        onStartListening={voiceChat.startListening}
        onStopListening={voiceChat.stopListening}
        onStopSpeaking={voiceChat.stopSpeaking}
        onClearMessages={voiceChat.clearMessages}
        onSpeakText={voiceChat.speakText}
      />
    </div>
  );
}
