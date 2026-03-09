import { useState, useRef } from "react";
import { Upload, XCircle, Loader2, Sparkles, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

export interface PostFormData {
  postType: string;
  dishName: string;
  priceOld: string;
  priceNew: string;
  validity: string;
  tone: string;
  imageFile: File | null;
  imagePreview: string | null;
}

interface PostGeneratorFormProps {
  form: PostFormData;
  setForm: React.Dispatch<React.SetStateAction<PostFormData>>;
  onGenerate: () => void;
  isGenerating: boolean;
}

const POST_TYPES = [
  { value: "promocao", label: "🏷️ Promoção / Desconto" },
  { value: "lancamento", label: "🆕 Lançamento de prato" },
  { value: "evento", label: "🎉 Evento especial" },
  { value: "fidelizacao", label: "💛 Fidelização / agradecimento" },
  { value: "aniversario", label: "🎂 Aniversário de cliente" },
  { value: "tematico", label: "📅 Dia da semana temático" },
];

const TONES = [
  { value: "divertido", label: "😄 Divertido e informal" },
  { value: "sofisticado", label: "✨ Sofisticado e elegante" },
  { value: "urgente", label: "⚡ Urgente e direto" },
  { value: "caloroso", label: "🤗 Caloroso e acolhedor" },
];

export function PostGeneratorForm({ form, setForm, onGenerate, isGenerating }: PostGeneratorFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 5MB");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Formato aceito: JPG, PNG ou WEBP");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setForm((prev) => ({
        ...prev,
        imageFile: file,
        imagePreview: reader.result as string,
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setForm((prev) => ({ ...prev, imageFile: null, imagePreview: null }));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const hasPrice = form.postType === "promocao";

  // Validate prices
  const priceError = (() => {
    if (!hasPrice || !form.priceOld || !form.priceNew) return null;
    const oldP = parseFloat(form.priceOld);
    const newP = parseFloat(form.priceNew);
    if (oldP > 0 && newP > 0 && newP >= oldP) return "Preço promocional deve ser menor que o original";
    return null;
  })();

  const canGenerate = form.dishName.trim() && form.imagePreview && !priceError;

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="w-5 h-5 text-primary" />
          Criar Post para Instagram
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Post Type */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Tipo de post</Label>
          <Select value={form.postType} onValueChange={(v) => setForm((p) => ({ ...p, postType: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {POST_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dish Name */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Nome do prato ou campanha *</Label>
          <Input
            placeholder="Ex: Hambúrguer de Camarão Crocante"
            value={form.dishName}
            onChange={(e) => setForm((p) => ({ ...p, dishName: e.target.value }))}
          />
        </div>

        {/* Prices (conditional) */}
        {hasPrice && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Preço original</Label>
              <Input
                placeholder="90"
                type="number"
                value={form.priceOld}
                onChange={(e) => setForm((p) => ({ ...p, priceOld: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Preço promocional</Label>
              <Input
                placeholder="50"
                type="number"
                value={form.priceNew}
                onChange={(e) => setForm((p) => ({ ...p, priceNew: e.target.value }))}
              />
            </div>
            {priceError && (
              <p className="col-span-2 text-xs text-destructive">{priceError}</p>
            )}
          </div>
        )}

        {/* Validity */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Validade da oferta (opcional)</Label>
          <Input
            placeholder="Só hoje, Até domingo, Por tempo limitado"
            value={form.validity}
            onChange={(e) => setForm((p) => ({ ...p, validity: e.target.value }))}
          />
        </div>

        {/* Tone */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Tom de voz</Label>
          <Select value={form.tone} onValueChange={(v) => setForm((p) => ({ ...p, tone: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TONES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Image Upload */}
        <div className="space-y-1.5">
          <Label className="text-sm font-medium">Foto do prato *</Label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleImageUpload}
          />
          {form.imagePreview ? (
            <div className="relative rounded-lg overflow-hidden border border-border">
              <img
                src={form.imagePreview}
                alt="Preview"
                className="w-full h-48 object-cover"
              />
              <button
                onClick={removeImage}
                className="absolute top-2 right-2 p-1 rounded-full bg-background/80 hover:bg-background text-destructive"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-36 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-muted/30 transition-colors"
            >
              <Upload className="w-8 h-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Clique para enviar (JPG, PNG, WEBP — até 5MB)</span>
            </button>
          )}
        </div>

        {/* Generate Button */}
        <Button
          className="w-full gap-2"
          size="lg"
          disabled={!canGenerate || isGenerating}
          onClick={onGenerate}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Gerando copy com IA...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Gerar Post
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
