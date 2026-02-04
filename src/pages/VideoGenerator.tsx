import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Film
} from "lucide-react";
import { useVideoGenerator, VideoJob, CreateVideoParams } from "@/hooks/useVideoGenerator";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const TEMPLATE_INFO = {
  A: {
    name: "Promo Rápida",
    description: "Texto forte no início, imagens com transição, CTA final",
    recommended: "7s / 15s",
  },
  B: {
    name: "Apresentação",
    description: "Nome + local, depois imagens, texto intermediário, CTA",
    recommended: "15s / 30s",
  },
  C: {
    name: "Cardápio/Pratos",
    description: "Cada imagem com texto sobreposto, ideal para pratos",
    recommended: "15s / 30s",
  },
};

const CTA_OPTIONS = [
  { value: "reserve", label: "Reserve agora" },
  { value: "queue", label: "Entre na fila" },
  { value: "whatsapp", label: "Chame no WhatsApp" },
  { value: "custom", label: "Personalizado" },
];

export default function VideoGenerator() {
  const {
    videoJobs,
    isLoadingJobs,
    usage,
    uploadProgress,
    uploadImages,
    createVideo,
    isCreating,
    deleteVideo,
    isDeleting,
  } = useVideoGenerator();

  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewVideo, setPreviewVideo] = useState<VideoJob | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    restaurant_name: "",
    location: "",
    promo_text: "",
    template: "A" as "A" | "B" | "C",
    duration: 15 as 7 | 15 | 30,
    cta_type: "" as string,
    cta_custom: "",
  });

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    if (files.length + selectedImages.length > 8) {
      toast.error("Máximo de 8 imagens permitidas");
      return;
    }

    const newImages = [...selectedImages, ...files].slice(0, 8);
    setSelectedImages(newImages);

    // Generate previews
    const newPreviews = newImages.map(file => URL.createObjectURL(file));
    setImagePreviewUrls(prev => {
      prev.forEach(url => URL.revokeObjectURL(url));
      return newPreviews;
    });
  };

  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
    
    URL.revokeObjectURL(imagePreviewUrls[index]);
    setImagePreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!formData.restaurant_name.trim()) {
      toast.error("Informe o nome do restaurante");
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

    try {
      setIsUploading(true);

      // Upload images
      const imageUrls = await uploadImages(selectedImages);

      // Upload logo if provided
      let logoUrl: string | undefined;
      if (logoFile) {
        const [url] = await uploadImages([logoFile]);
        logoUrl = url;
      }

      // Create video job
      const params: CreateVideoParams = {
        restaurant_name: formData.restaurant_name,
        location: formData.location || undefined,
        promo_text: formData.promo_text || undefined,
        template: formData.template,
        duration: formData.duration,
        cta_type: formData.cta_type as CreateVideoParams["cta_type"] || undefined,
        cta_custom: formData.cta_custom || undefined,
        image_urls: imageUrls,
        logo_url: logoUrl,
      };

      createVideo(params);

      // Reset form
      setSelectedImages([]);
      setImagePreviewUrls([]);
      setLogoFile(null);
      setLogoPreview(null);
      setFormData({
        restaurant_name: "",
        location: "",
        promo_text: "",
        template: "A",
        duration: 15,
        cta_type: "",
        cta_custom: "",
      });
    } catch (error) {
      console.error("Error submitting:", error);
      toast.error("Erro ao processar imagens");
    } finally {
      setIsUploading(false);
    }
  };

  const copyVideoLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const getStatusBadge = (status: VideoJob["status"]) => {
    switch (status) {
      case "queued":
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" /> Na fila</Badge>;
      case "rendering":
        return <Badge className="gap-1 bg-primary"><Loader2 className="h-3 w-3 animate-spin" /> Gerando</Badge>;
      case "done":
        return <Badge className="gap-1 bg-primary/80"><CheckCircle className="h-3 w-3" /> Pronto</Badge>;
      case "failed":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Falhou</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Film className="h-6 w-6 text-primary" />
            Gerador de Vídeos
          </h1>
          <p className="text-muted-foreground">
            Crie vídeos profissionais para Reels e Stories automaticamente
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

        <TabsContent value="create" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left Column - Form */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações do Restaurante</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="restaurant_name">Nome do Restaurante *</Label>
                    <Input
                      id="restaurant_name"
                      placeholder="Ex: Sabor & Arte"
                      value={formData.restaurant_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, restaurant_name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Bairro / Cidade</Label>
                    <Input
                      id="location"
                      placeholder="Ex: Jardins, São Paulo"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="promo_text">Promoção / Destaque</Label>
                    <Textarea
                      id="promo_text"
                      placeholder="Ex: Rodízio completo hoje! ou Happy Hour até 20h"
                      value={formData.promo_text}
                      onChange={(e) => setFormData(prev => ({ ...prev, promo_text: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Template e Duração</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Template</Label>
                    <div className="grid gap-3">
                      {(["A", "B", "C"] as const).map((t) => (
                        <div
                          key={t}
                          onClick={() => setFormData(prev => ({ ...prev, template: t }))}
                          className={`p-3 border rounded-lg cursor-pointer transition-all ${
                            formData.template === t
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{TEMPLATE_INFO[t].name}</span>
                            <Badge variant="outline">{TEMPLATE_INFO[t].recommended}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {TEMPLATE_INFO[t].description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Duração</Label>
                    <Select
                      value={formData.duration.toString()}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, duration: parseInt(v) as 7 | 15 | 30 }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7">7 segundos</SelectItem>
                        <SelectItem value="15">15 segundos</SelectItem>
                        <SelectItem value="30">30 segundos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>CTA Final (opcional)</Label>
                    <Select
                      value={formData.cta_type}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, cta_type: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um CTA" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sem CTA</SelectItem>
                        {CTA_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.cta_type === "custom" && (
                      <Input
                        placeholder="Texto do CTA personalizado"
                        value={formData.cta_custom}
                        onChange={(e) => setFormData(prev => ({ ...prev, cta_custom: e.target.value }))}
                        className="mt-2"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Images */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Imagens *
                  </CardTitle>
                  <CardDescription>
                    Selecione de 3 a 8 imagens (JPG/PNG)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    {imagePreviewUrls.map((url, index) => (
                      <div key={index} className="relative aspect-[9/16] rounded-lg overflow-hidden bg-muted">
                        <img src={url} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                        <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
                          {index + 1}
                        </div>
                      </div>
                    ))}
                    {selectedImages.length < 8 && (
                      <label className="aspect-[9/16] rounded-lg border-2 border-dashed border-muted-foreground/25 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Adicionar</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png"
                          multiple
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    {selectedImages.length}/8 imagens selecionadas
                    {selectedImages.length < 3 && " (mínimo 3)"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Logo (opcional)</CardTitle>
                </CardHeader>
                <CardContent>
                  {logoPreview ? (
                    <div className="flex items-center gap-4">
                      <img src={logoPreview} alt="Logo preview" className="h-16 w-16 object-contain rounded" />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setLogoFile(null);
                          setLogoPreview(null);
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" /> Remover
                      </Button>
                    </div>
                  ) : (
                    <label className="flex items-center gap-3 p-4 border-2 border-dashed rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Clique para adicionar logo (PNG)</span>
                      <input
                        type="file"
                        accept="image/png"
                        onChange={handleLogoSelect}
                        className="hidden"
                      />
                    </label>
                  )}
                </CardContent>
              </Card>

              {/* Progress and Submit */}
              {(isUploading || uploadProgress > 0) && (
                <Card>
                  <CardContent className="pt-6">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Enviando imagens...</span>
                        <span>{Math.round(uploadProgress)}%</span>
                      </div>
                      <Progress value={uploadProgress} />
                    </div>
                  </CardContent>
                </Card>
              )}

              <Button
                onClick={handleSubmit}
                disabled={isUploading || isCreating || selectedImages.length < 3}
                className="w-full h-12 text-lg gap-2"
              >
                {isUploading || isCreating ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    {isUploading ? "Enviando imagens..." : "Criando vídeo..."}
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
                  <div className="aspect-[9/16] bg-muted relative">
                    {job.thumbnail_url ? (
                      <img src={job.thumbnail_url} alt="Thumbnail" className="w-full h-full object-cover" />
                    ) : job.image_urls?.[0] ? (
                      <img src={job.image_urls[0]} alt="Preview" className="w-full h-full object-cover" style={{ opacity: 0.6 }} />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Video className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      {getStatusBadge(job.status)}
                    </div>
                    <div className="absolute bottom-2 left-2 flex gap-1">
                      <Badge variant="secondary">{job.template}</Badge>
                      <Badge variant="secondary">{job.duration}s</Badge>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <h4 className="font-medium truncate">{job.restaurant_name}</h4>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(job.created_at), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    {job.error_message && (
                      <p className="text-xs text-destructive">{job.error_message}</p>
                    )}
                    <div className="flex gap-2">
                      {job.status === "done" && job.video_url && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-1"
                            onClick={() => setPreviewVideo(job)}
                          >
                            <Eye className="h-4 w-4" /> Ver
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a href={job.video_url} download>
                              <Download className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyVideoLink(job.video_url!)}
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
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
            <DialogTitle>{previewVideo?.restaurant_name}</DialogTitle>
          </DialogHeader>
          {previewVideo?.video_url && (
            <video
              src={previewVideo.video_url}
              controls
              autoPlay
              className="w-full aspect-[9/16] rounded-lg bg-black"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
