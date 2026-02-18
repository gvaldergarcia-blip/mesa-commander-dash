import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  GripVertical,
} from "lucide-react";
import { useVideoGenerator, type VideoJob, type CreateVideoParams } from "@/hooks/useVideoGenerator";
import { SlideshowPreview } from "@/components/video/SlideshowPreview";
import { getTemplateList } from "@/lib/video/videoRenderer";
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

const MUSIC_OPTIONS = [
  { value: "none", label: "Nenhuma" },
  { value: "lofi", label: "Lo-fi (em breve)" },
  { value: "pop", label: "Pop leve (em breve)" },
  { value: "eletronica", label: "Eletrônica leve (em breve)" },
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

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<VideoJob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    headline: "",
    subtext: "",
    format: "vertical" as "vertical" | "square",
    duration: 15 as 7 | 15 | 30,
    templateId: "elegante",
    cta: "",
    musicId: "none",
  });

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
    if (usage && usage.videos_generated >= usage.limit) {
      toast.error(`Limite mensal atingido (${usage.limit} vídeos)`);
      return;
    }

    const params: CreateVideoParams = {
      headline: formData.headline.trim(),
      subtext: formData.subtext.trim() || undefined,
      cta: formData.cta || undefined,
      format: formData.format,
      duration: formData.duration,
      templateId: formData.templateId,
      musicId: formData.musicId !== "none" ? formData.musicId : undefined,
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
        setFormData({
          headline: "",
          subtext: "",
          format: "vertical",
          duration: 15,
          templateId: "elegante",
          cta: "",
          musicId: "none",
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

  // Get active rendering state
  const overallProgress = isBusy
    ? uploadProgress > 0 && renderProgress === 0
      ? uploadProgress * 0.3 // Upload = 0-30%
      : 30 + renderProgress * 0.7 // Render = 30-100%
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" />
            Marketing IA — Vídeo Automático
          </h1>
          <p className="text-muted-foreground">
            Gere vídeos profissionais para Reels e Stories automaticamente
          </p>
        </div>
        {usage && (
          <Card className="px-4 py-2">
            <div className="text-sm text-muted-foreground">Vídeos este mês</div>
            <div className="text-xl font-bold">
              {usage.videos_generated} / {usage.limit}
            </div>
          </Card>
        )}
      </div>

      <Tabs defaultValue="create" className="space-y-6">
        <TabsList>
          <TabsTrigger value="create" className="gap-2">
            <Plus className="h-4 w-4" /> Criar Vídeo
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Video className="h-4 w-4" /> Meus Vídeos
          </TabsTrigger>
        </TabsList>

        {/* ─── CREATE TAB ─── */}
        <TabsContent value="create" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: Form */}
            <div className="space-y-6">
              {/* Headline & Subtext */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Textos do Vídeo</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="headline">Headline * (máx 40 caracteres)</Label>
                    <Input
                      id="headline"
                      placeholder="Ex: Sabor que marca presença"
                      value={formData.headline}
                      maxLength={40}
                      onChange={(e) => setFormData((p) => ({ ...p, headline: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground text-right">{formData.headline.length}/40</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="subtext">Subtexto (máx 90 caracteres)</Label>
                    <Input
                      id="subtext"
                      placeholder="Ex: Happy Hour de terça a sexta até 20h"
                      value={formData.subtext}
                      maxLength={90}
                      onChange={(e) => setFormData((p) => ({ ...p, subtext: e.target.value }))}
                    />
                    <p className="text-xs text-muted-foreground text-right">{formData.subtext.length}/90</p>
                  </div>
                </CardContent>
              </Card>

              {/* Format, Template, Duration */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configurações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Format */}
                  <div className="space-y-2">
                    <Label>Formato</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "vertical" as const, label: "Vertical", desc: "1080×1920 (Reels/Stories)" },
                        { value: "square" as const, label: "Quadrado", desc: "1080×1080 (Feed)" },
                      ].map((f) => (
                        <div
                          key={f.value}
                          onClick={() => setFormData((p) => ({ ...p, format: f.value }))}
                          className={`p-3 border rounded-lg cursor-pointer transition-all text-center ${
                            formData.format === f.value
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="font-medium text-sm">{f.label}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Template */}
                  <div className="space-y-2">
                    <Label>Template</Label>
                    <div className="grid gap-2">
                      {TEMPLATES.map((t) => (
                        <div
                          key={t.id}
                          onClick={() => setFormData((p) => ({ ...p, templateId: t.id }))}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            formData.templateId === t.id
                              ? "border-primary bg-primary/5 ring-1 ring-primary"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <span className="font-medium text-sm">{t.name}</span>
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <Select
                      value={formData.duration.toString()}
                      onValueChange={(v) => setFormData((p) => ({ ...p, duration: parseInt(v) as 7 | 15 | 30 }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 segundos</SelectItem>
                        <SelectItem value="15">15 segundos</SelectItem>
                        <SelectItem value="30">30 segundos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* CTA */}
                  <div className="space-y-2">
                    <Label>CTA Final</Label>
                    <Select
                      value={formData.cta || "none"}
                      onValueChange={(v) => setFormData((p) => ({ ...p, cta: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger><SelectValue placeholder="Sem CTA" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem CTA</SelectItem>
                        {CTA_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Music */}
                  <div className="space-y-2">
                    <Label>Música de fundo</Label>
                    <Select
                      value={formData.musicId}
                      onValueChange={(v) => setFormData((p) => ({ ...p, musicId: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {MUSIC_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right: Images + Submit */}
            <div className="space-y-6">
              {/* Images upload */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Imagens * (3 a 8)
                  </CardTitle>
                  <CardDescription>
                    Envie fotos do restaurante, pratos, ambiente. Arraste para reordenar.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {imagePreviewUrls.map((url, index) => (
                      <div
                        key={url}
                        className={`relative rounded-lg overflow-hidden bg-muted border-2 border-transparent hover:border-primary/30 transition-colors ${
                          formData.format === "vertical" ? "aspect-[9/16]" : "aspect-square"
                        }`}
                      >
                        <img src={url} alt={`${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-1 left-1 flex gap-0.5">
                          <button
                            onClick={() => moveImage(index, index - 1)}
                            disabled={index === 0}
                            className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded disabled:opacity-30"
                          >
                            ←
                          </button>
                          <span className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                            {index + 1}
                          </span>
                          <button
                            onClick={() => moveImage(index, index + 1)}
                            disabled={index === selectedImages.length - 1}
                            className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded disabled:opacity-30"
                          >
                            →
                          </button>
                        </div>
                      </div>
                    ))}
                    {selectedImages.length < 8 && (
                      <label
                        className={`rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors ${
                          formData.format === "vertical" ? "aspect-[9/16]" : "aspect-square"
                        }`}
                      >
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Adicionar</span>
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
                  <p className="text-xs text-muted-foreground mt-3">
                    {selectedImages.length}/8 imagens
                    {selectedImages.length < 3 && " (mínimo 3)"}
                  </p>
                </CardContent>
              </Card>

              {/* Logo */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Logo (opcional)</CardTitle>
                </CardHeader>
                <CardContent>
                  {logoPreview ? (
                    <div className="flex items-center gap-4">
                      <img src={logoPreview} alt="Logo" className="h-16 w-16 object-contain rounded" />
                      <Button variant="outline" size="sm" onClick={() => { setLogoFile(null); setLogoPreview(null); }}>
                        <Trash2 className="h-4 w-4 mr-2" /> Remover
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Adicionar logo (PNG)</span>
                      <input type="file" accept="image/png" onChange={handleLogoSelect} className="hidden" />
                    </label>
                  )}
                </CardContent>
              </Card>

              {/* Progress */}
              {isBusy && (
                <Card>
                  <CardContent className="pt-6 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span>
                        {uploadProgress > 0 && renderProgress === 0
                          ? "Enviando imagens..."
                          : "Gerando vídeo..."}
                      </span>
                      <span>{Math.round(overallProgress)}%</span>
                    </div>
                    <Progress value={overallProgress} />
                    {isRendering && (
                      <p className="text-xs text-muted-foreground">
                        Renderizando frames... Não feche esta aba.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={isBusy || selectedImages.length < 3}
                className="w-full h-12 text-lg gap-2"
              >
                {isBusy ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Gerando vídeo...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5" />
                    Gerar Vídeo
                  </>
                )}
              </Button>
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
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Video className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Nenhum vídeo criado ainda</h3>
                <p className="text-muted-foreground">Crie seu primeiro vídeo na aba "Criar Vídeo"</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {videoJobs.map((job) => (
                <Card key={job.id} className="overflow-hidden">
                  <div className={`bg-muted relative ${job.format === "square" ? "aspect-square" : "aspect-[9/16]"}`}>
                    {job.thumbnail_url ? (
                      <img src={job.thumbnail_url} alt="Thumb" className="w-full h-full object-cover" />
                    ) : job.image_urls?.[0] ? (
                      <img src={job.image_urls[0]} alt="Preview" className="w-full h-full object-cover opacity-60" />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Video className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">{getStatusBadge(job.status)}</div>
                    <div className="absolute bottom-2 left-2 flex gap-1">
                      <Badge variant="secondary" className="text-xs">{job.template_id}</Badge>
                      <Badge variant="secondary" className="text-xs">{job.duration_seconds}s</Badge>
                      <Badge variant="secondary" className="text-xs">{job.format === "vertical" ? "9:16" : "1:1"}</Badge>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h4 className="font-medium truncate">{job.headline}</h4>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(job.created_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    {job.error_message && (
                      <p className="text-xs text-destructive">{job.error_message}</p>
                    )}
                    <div className="flex gap-2">
                      {job.status === "done" && (
                        <>
                          <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => setPreviewVideo(job)}>
                            <Eye className="h-4 w-4" /> Ver
                          </Button>
                          {job.video_url && (
                            <>
                              <Button variant="outline" size="sm" asChild>
                                <a href={job.video_url} download><Download className="h-4 w-4" /></a>
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => copyVideoLink(job.video_url!)}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteVideo(job.id)}
                        disabled={isDeleting}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Video Preview Dialog */}
      <Dialog open={!!previewVideo} onOpenChange={() => setPreviewVideo(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{previewVideo?.headline}</DialogTitle>
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
    </div>
  );
}
