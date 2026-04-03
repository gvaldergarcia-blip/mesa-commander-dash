import { useRef, useState } from 'react';
import { Send, Megaphone, Gift, MessageSquare, Upload, X, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RestaurantCustomer } from '@/hooks/useRestaurantCustomers';
import { supabase } from '@/lib/supabase/client';
import { useToast } from '@/hooks/use-toast';

type PromotionType = 'message' | 'banner' | 'coupon';

export interface SendPromotionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: RestaurantCustomer;
  onSubmit: (data: {
    title: string;
    subject: string;
    message: string;
    ctaText?: string;
    ctaUrl?: string;
    couponCode?: string;
    expiresAt?: string;
    imageUrl?: string;
    recipients: { email?: string; phone?: string; name?: string; customerId?: string }[];
  }) => Promise<void>;
  isSubmitting: boolean;
}

export function SendPromotionDialog({
  open,
  onOpenChange,
  customer,
  onSubmit,
  isSubmitting,
}: SendPromotionDialogProps) {
  const [promotionType, setPromotionType] = useState<PromotionType>('message');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFilePickerOpenRef = useRef(false);
  const { toast } = useToast();
  const { restaurantId } = useRestaurant();

  const resetForm = () => {
    setPromotionType('message');
    setTitle('');
    setSubject('');
    setMessage('');
    setCtaUrl('');
    setCouponCode('');
    setExpiresAt('');
    setImageFile(null);
    setImagePreview(null);
  };

  const openImagePicker = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    isFilePickerOpenRef.current = true;
    // Release lock after a generous delay to cover slow file pickers
    const releaseTimer = window.setTimeout(() => {
      isFilePickerOpenRef.current = false;
    }, 5000);
    // If a file is selected, the onChange handler clears the lock immediately
    // Store timer so onChange can clear it
    (fileInputRef as any)._releaseTimer = releaseTimer;
    fileInputRef.current?.click();
  };

  const handleDialogChange = (nextOpen: boolean) => {
    if (!nextOpen && isFilePickerOpenRef.current) {
      return;
    }
    if (!nextOpen && uploadingImage) {
      return;
    }

    if (!nextOpen) {
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Clear the release timer and lock immediately
    if ((fileInputRef as any)._releaseTimer) {
      clearTimeout((fileInputRef as any)._releaseTimer);
    }
    isFilePickerOpenRef.current = false;
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tipo
    if (!file.type.startsWith('image/')) {
      e.target.value = '';
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem (JPG, PNG, etc.)',
        variant: 'destructive',
      });
      return;
    }

    // Validar tamanho (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      e.target.value = '';
      toast({
        title: 'Imagem muito grande',
        description: 'A imagem deve ter no máximo 5MB',
        variant: 'destructive',
      });
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    setUploadingImage(true);
    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${restaurantId}/promotions/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('promotion-images')
        .upload(filePath, imageFile, {
          cacheControl: '3600',
          contentType: imageFile.type,
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('promotion-images')
        .createSignedUrl(filePath, 60 * 60 * 24 * 365);

      if (signedUrlError) {
        console.warn('Falling back to public URL for promotion image:', signedUrlError);
        const { data: urlData } = supabase.storage
          .from('promotion-images')
          .getPublicUrl(filePath);
        return urlData.publicUrl;
      }

      return signedUrlData.signedUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      toast({
        title: 'Erro ao enviar imagem',
        description: 'Não foi possível fazer upload da imagem',
        variant: 'destructive',
      });
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async () => {
    // Upload image if present
    let imageUrl: string | undefined;
    if (imageFile) {
      const uploadedUrl = await uploadImage();
      if (uploadedUrl) {
        imageUrl = uploadedUrl;
      }
    }

    await onSubmit({
      title: title || `Promoção para ${customer.customer_name || customer.customer_email}`,
      subject,
      message,
      ctaText: ctaUrl ? 'Ver oferta' : undefined, // Sempre "Ver oferta"
      ctaUrl: ctaUrl || undefined,
      couponCode: promotionType === 'coupon' ? couponCode : undefined,
      expiresAt: expiresAt || undefined,
      imageUrl,
      recipients: [{
        email: customer.customer_email,
        phone: customer.customer_phone || undefined,
        name: customer.customer_name || undefined,
        customerId: customer.id,
      }],
    });
    resetForm();
    onOpenChange(false);
  };

  const isFormValid = subject.trim() && message.trim() && 
    (promotionType !== 'coupon' || couponCode.trim()) && !uploadingImage;

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent
        className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto"
        onInteractOutside={(event) => {
          if (isFilePickerOpenRef.current || uploadingImage) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (isFilePickerOpenRef.current || uploadingImage) {
            event.preventDefault();
          }
        }}
        onPointerDownOutside={(event) => {
          if (isFilePickerOpenRef.current || uploadingImage) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          if (isFilePickerOpenRef.current || uploadingImage) {
            event.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="w-5 h-5 text-primary" />
            Enviar Promoção
          </DialogTitle>
          <DialogDescription>
            Enviar promoção por SMS{customer.customer_email ? ' e e-mail' : ''} para este cliente
          </DialogDescription>
        </DialogHeader>

        {/* Destinatário */}
        <div className="bg-muted/50 rounded-lg p-4 border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Destinatário</p>
              <p className="font-medium">{customer.customer_name || 'Sem nome'}</p>
              {customer.customer_phone && (
                <p className="text-sm text-muted-foreground">📱 {customer.customer_phone}</p>
              )}
              {customer.customer_email && (
                <p className="text-sm text-muted-foreground">✉️ {customer.customer_email}</p>
              )}
            </div>
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              1 cliente
            </Badge>
          </div>
        </div>

        {/* Tipo de promoção */}
        <div className="space-y-2">
          <Label>Tipo de promoção</Label>
          <Select value={promotionType} onValueChange={(v) => setPromotionType(v as PromotionType)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="message">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Mensagem direta
                </div>
              </SelectItem>
              <SelectItem value="banner">
                <div className="flex items-center gap-2">
                  <Megaphone className="w-4 h-4" />
                  Banner / Anúncio
                </div>
              </SelectItem>
              <SelectItem value="coupon">
                <div className="flex items-center gap-2">
                  <Gift className="w-4 h-4" />
                  Cupom de desconto
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Campos do formulário */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="subject">Assunto *</Label>
            <Input
              id="subject"
              placeholder="Ex: Oferta especial para você!"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              placeholder="Escreva sua mensagem aqui..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
            />
          </div>

          {promotionType === 'coupon' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="couponCode">Código do cupom *</Label>
                <Input
                  id="couponCode"
                  placeholder="Ex: DESCONTO10"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiresAt">Válido até (opcional)</Label>
                <Input
                  id="expiresAt"
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </>
          )}

          {(promotionType === 'banner' || promotionType === 'coupon') && (
              <div className="space-y-2">
                <Label htmlFor="ctaUrl">Link da imagem (opcional)</Label>
                <Input
                  id="ctaUrl"
                  placeholder="https://..."
                  value={ctaUrl}
                  onChange={(e) => setCtaUrl(e.target.value)}
                />
                {ctaUrl && (
                  <p className="text-xs text-muted-foreground">
                    O botão "Ver oferta" será exibido no e-mail
                  </p>
                )}
              </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleDialogChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !isFormValid}
            className="gap-2"
          >
            {isSubmitting ? (
              'Enviando...'
            ) : (
              <>
                <Send className="w-4 h-4" />
                Enviar promoção
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
