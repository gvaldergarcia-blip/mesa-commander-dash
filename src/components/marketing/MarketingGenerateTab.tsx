import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Sparkles, Download, Square, Smartphone } from 'lucide-react';
import { useMarketingPosts } from '@/hooks/useMarketingPosts';
import { useRestaurant } from '@/contexts/RestaurantContext';

const POST_TYPES = [
  { value: 'fila', label: 'Fila aberta' },
  { value: 'reserva', label: 'Reserva disponível' },
  { value: 'promo', label: 'Promoção' },
  { value: 'destaque', label: 'Novo prato / destaque' },
  { value: 'evento', label: 'Aniversário / evento' },
];

const CTA_OPTIONS = [
  { value: 'Entrar na fila', label: 'Entrar na fila' },
  { value: 'Reservar', label: 'Reservar' },
  { value: 'Chamar no WhatsApp', label: 'Chamar no WhatsApp' },
  { value: 'Ver cardápio', label: 'Ver cardápio' },
];

const TEMPLATES = [
  { value: 'gradient_warm', label: 'Gradiente Quente', color: 'bg-gradient-to-br from-orange-400 to-amber-600' },
  { value: 'gradient_dark', label: 'Elegante Escuro', color: 'bg-gradient-to-br from-gray-800 to-gray-950' },
  { value: 'minimal_light', label: 'Minimalista Claro', color: 'bg-gradient-to-br from-white to-orange-50' },
  { value: 'vibrant_food', label: 'Vibrante Food', color: 'bg-gradient-to-br from-red-500 to-orange-500' },
  { value: 'elegant_black', label: 'Preto & Dourado', color: 'bg-gradient-to-br from-black to-yellow-900' },
];

export function MarketingGenerateTab() {
  const { restaurant } = useRestaurant();
  const { generate, isGenerating } = useMarketingPosts();
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);

  const [type, setType] = useState('fila');
  const [format, setFormat] = useState<'square' | 'story'>('square');
  const [headline, setHeadline] = useState('');
  const [subtext, setSubtext] = useState('');
  const [cta, setCta] = useState('Entrar na fila');
  const [templateId, setTemplateId] = useState('gradient_warm');

  const handleGenerate = async () => {
    if (!headline.trim()) return;
    try {
      const result = await generate({
        type,
        format,
        headline: headline.trim(),
        subtext: subtext.trim() || undefined,
        cta,
        template_id: templateId,
      });
      if (result?.post?.image_url) {
        setGeneratedImage(result.post.image_url);
      }
    } catch {
      // error handled by hook
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configurar Post</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Restaurant info */}
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-sm text-muted-foreground">Restaurante</p>
            <p className="font-semibold text-foreground">{restaurant?.name || 'Carregando...'}</p>
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Tipo de Post</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POST_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Headline */}
          <div className="space-y-2">
            <Label>Texto Principal <span className="text-destructive">*</span></Label>
            <Input
              value={headline}
              onChange={(e) => setHeadline(e.target.value.slice(0, 40))}
              placeholder="Ex: Fila aberta agora!"
              maxLength={40}
            />
            <p className="text-xs text-muted-foreground">{headline.length}/40 caracteres</p>
          </div>

          {/* Subtext */}
          <div className="space-y-2">
            <Label>Texto Secundário (opcional)</Label>
            <Input
              value={subtext}
              onChange={(e) => setSubtext(e.target.value.slice(0, 90))}
              placeholder="Ex: Venha experimentar nosso cardápio especial"
              maxLength={90}
            />
            <p className="text-xs text-muted-foreground">{subtext.length}/90 caracteres</p>
          </div>

          {/* CTA */}
          <div className="space-y-2">
            <Label>Call-to-Action</Label>
            <Select value={cta} onValueChange={setCta}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CTA_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Format */}
          <div className="space-y-2">
            <Label>Formato</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={format === 'square' ? 'default' : 'outline'}
                onClick={() => setFormat('square')}
                className="flex-1 gap-2"
              >
                <Square className="h-4 w-4" /> Quadrado (1080×1080)
              </Button>
              <Button
                type="button"
                variant={format === 'story' ? 'default' : 'outline'}
                onClick={() => setFormat('story')}
                className="flex-1 gap-2"
              >
                <Smartphone className="h-4 w-4" /> Story (1080×1920)
              </Button>
            </div>
          </div>

          {/* Template */}
          <div className="space-y-2">
            <Label>Template</Label>
            <div className="grid grid-cols-5 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setTemplateId(t.value)}
                  className={`rounded-lg h-14 border-2 transition-all ${t.color} ${
                    templateId === t.value
                      ? 'border-primary ring-2 ring-primary/30 scale-105'
                      : 'border-transparent hover:border-muted-foreground/30'
                  }`}
                  title={t.label}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {TEMPLATES.find((t) => t.value === templateId)?.label}
            </p>
          </div>

          {/* Generate */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !headline.trim()}
            className="w-full gap-2"
            size="lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Gerando post...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Gerar Post com IA
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Preview</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center min-h-[400px]">
          {isGenerating ? (
            <div className="text-center space-y-3">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">A IA está criando seu post...</p>
              <p className="text-xs text-muted-foreground">Isso pode levar alguns segundos</p>
            </div>
          ) : generatedImage ? (
            <div className="space-y-4 w-full">
              <div className={`mx-auto overflow-hidden rounded-lg border shadow-lg ${
                format === 'story' ? 'max-w-[270px]' : 'max-w-[400px]'
              }`}>
                <img
                  src={generatedImage}
                  alt="Post gerado"
                  className="w-full h-auto"
                />
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = generatedImage;
                    a.download = `post_${type}_${format}.png`;
                    a.target = '_blank';
                    a.click();
                  }}
                >
                  <Download className="h-4 w-4" /> Baixar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(generatedImage);
                    import('sonner').then(({ toast }) => toast.success('Link copiado!'));
                  }}
                >
                  Copiar Link
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground space-y-2">
              <Sparkles className="h-10 w-10 mx-auto opacity-30" />
              <p>Configure e gere seu post</p>
              <p className="text-xs">A imagem aparecerá aqui</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
