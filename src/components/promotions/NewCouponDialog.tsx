import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCoupons } from '@/hooks/useCoupons';
import { useRestaurantTerms } from '@/hooks/useRestaurantTerms';
import { useRestaurant } from '@/contexts/RestaurantContext';
import { supabase } from '@/lib/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { differenceInDays, format } from 'date-fns';
import { Upload, FileText, Link as LinkIcon, X } from 'lucide-react';

type NewCouponDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewCouponDialog({ open, onOpenChange }: NewCouponDialogProps) {
  const { restaurantId } = useRestaurant();
  const { toast } = useToast();
  const { createCoupon } = useCoupons();
  const { termsAccepted, acceptTerms, loading: termsLoading } = useRestaurantTerms();
  
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [couponTitle, setCouponTitle] = useState('');
  const [couponDescription, setCouponDescription] = useState('');
  const [couponType, setCouponType] = useState<'link' | 'upload'>('link');
  const [couponLink, setCouponLink] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>('');
  // Data de início padrão = HOJE para garantir que cupom apareça imediatamente
  const today = format(new Date(), 'yyyy-MM-dd');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [durationDays, setDurationDays] = useState(0);
  
  // Resetar data de início para hoje quando o dialog abrir
  useEffect(() => {
    if (open) {
      const currentDate = format(new Date(), 'yyyy-MM-dd');
      setStartDate(currentDate);
    }
  }, [open]);
  const [price, setPrice] = useState(0);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Calcular duração e preço quando as datas mudarem
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.max(1, differenceInDays(end, start) + 1); // +1 para incluir o dia final
      setDurationDays(days);
      
      // Nova regra: R$ 4,90 por dia de exibição
      const calculatedPrice = days * 4.90;
      setPrice(calculatedPrice);
    } else {
      setDurationDays(0);
      setPrice(0);
    }
  }, [startDate, endDate]);

  // Cleanup do preview quando trocar de tipo ou arquivo
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tamanho (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O arquivo deve ter no máximo 5MB',
        variant: 'destructive',
      });
      return;
    }

    // Validar tipo
    const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      toast({
        title: 'Tipo de arquivo inválido',
        description: 'Use apenas JPG, PNG ou PDF',
        variant: 'destructive',
      });
      return;
    }

    setUploadedFile(file);
    
    // Criar preview para imagens
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else {
      setFilePreviewUrl('');
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    setFilePreviewUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const validateForm = () => {
    if (!couponTitle.trim()) {
      toast({
        title: 'Título obrigatório',
        description: 'Digite um título para o cupom',
        variant: 'destructive',
      });
      return false;
    }

    if (!startDate || !endDate) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha as datas de início e término',
        variant: 'destructive',
      });
      return false;
    }

    if (new Date(endDate) <= new Date(startDate)) {
      toast({
        title: 'Datas inválidas',
        description: 'A data de término deve ser posterior à data de início',
        variant: 'destructive',
      });
      return false;
    }

    if (couponType === 'link' && !couponLink.trim()) {
      toast({
        title: 'Link obrigatório',
        description: 'Forneça o link do cupom',
        variant: 'destructive',
      });
      return false;
    }

    if (couponType === 'upload' && !uploadedFile) {
      toast({
        title: 'Arquivo obrigatório',
        description: 'Faça o upload do cupom',
        variant: 'destructive',
      });
      return false;
    }

    if (!acceptedTerms) {
      toast({
        title: 'Aceite necessário',
        description: 'Para continuar, é necessário aceitar os Termos de Publicação de Cupons',
        variant: 'destructive',
      });
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Se os termos gerais não foram aceitos, mostrar dialog
    if (!termsAccepted) {
      setShowTermsDialog(true);
      return;
    }

    // Criar cupom direto sem pagamento
    await handlePayment();
  };

  const uploadFile = async (): Promise<string | null> => {
    if (!uploadedFile) return null;

    try {
      const fileExt = uploadedFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${restaurantId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('coupons')
        .upload(filePath, uploadedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('coupons')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Erro no upload:', error);
      toast({
        title: 'Erro no upload',
        description: 'Não foi possível fazer o upload do arquivo',
        variant: 'destructive',
      });
      return null;
    }
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      let fileUrl: string | null = null;
      
      if (couponType === 'upload') {
        fileUrl = await uploadFile();
        if (!fileUrl) {
          throw new Error('Falha no upload do arquivo');
        }
      }

      // Garantir que a data de início seja NO MÁXIMO hoje (não pode ser futuro para aparecer no app)
      const startDateObj = new Date(startDate + 'T00:00:00');
      const todayObj = new Date();
      todayObj.setHours(0, 0, 0, 0);
      
      // Se a data de início for futura, o cupom será "agendado", não "ativo" no app
      const isScheduled = startDateObj > todayObj;
      
      console.log('[NewCouponDialog] Criando cupom:', {
        startDate,
        endDate,
        startDateObj: startDateObj.toISOString(),
        todayObj: todayObj.toISOString(),
        isScheduled
      });

      const coupon = await createCoupon({
        restaurant_id: restaurantId!,
        title: couponTitle.trim(),
        description: couponDescription.trim() || 'Oferta especial do restaurante',
        discount_type: 'fixed',
        discount_value: 0,
        coupon_type: couponType,
        redeem_link: couponType === 'link' ? couponLink : undefined,
        file_url: fileUrl || undefined,
        start_date: startDateObj.toISOString(),
        end_date: new Date(endDate + 'T23:59:59').toISOString(),
        duration_days: durationDays,
        price,
        status: 'active',
        payment_status: 'completed',
        payment_method: 'test',
        paid_at: new Date().toISOString(),
        tags: [],
      });
      
      const successMessage = isScheduled 
        ? `Cupom agendado! Ele aparecerá no app a partir de ${format(startDateObj, 'dd/MM/yyyy')}`
        : 'O cupom já está ativo e visível no app!';

      toast({
        title: 'Cupom criado com sucesso!',
        description: successMessage,
      });

      // Fechar o modal
      onOpenChange(false);
      resetForm();

      // Recarregar a página após 1 segundo
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error('Erro ao criar cupom:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao criar cupom',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTermsAccept = async () => {
    const accepted = await acceptTerms();
    if (accepted) {
      setShowTermsDialog(false);
      // Criar cupom direto após aceitar termos
      await handlePayment();
    }
  };

  const resetForm = () => {
    setCouponTitle('');
    setCouponDescription('');
    setCouponType('link');
    setCouponLink('');
    setUploadedFile(null);
    setFilePreviewUrl('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate('');
    setAcceptedTerms(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Cupom Pago</DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Título do Cupom */}
            <div>
              <Label htmlFor="title">Título do Cupom *</Label>
              <Input
                id="title"
                value={couponTitle}
                onChange={(e) => setCouponTitle(e.target.value)}
                placeholder="Ex: 20% OFF em todos os pratos principais"
                className="mt-1"
              />
            </div>

            {/* Descrição */}
            <div>
              <Label htmlFor="description">Descrição (opcional)</Label>
              <Input
                id="description"
                value={couponDescription}
                onChange={(e) => setCouponDescription(e.target.value)}
                placeholder="Ex: Válido para pedidos acima de R$ 50"
                className="mt-1"
              />
            </div>

            {/* Tipo de Cupom */}
            <div>
              <Label>Tipo de Cupom *</Label>
              <div className="flex gap-4 mt-2">
                <Button
                  type="button"
                  variant={couponType === 'link' ? 'default' : 'outline'}
                  onClick={() => setCouponType('link')}
                  className="flex-1"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  Link
                </Button>
                <Button
                  type="button"
                  variant={couponType === 'upload' ? 'default' : 'outline'}
                  onClick={() => setCouponType('upload')}
                  className="flex-1"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload
                </Button>
              </div>
            </div>

            {/* Campo de Link */}
            {couponType === 'link' && (
              <div>
                <Label htmlFor="link">Link do Cupom *</Label>
                <Input
                  id="link"
                  type="url"
                  value={couponLink}
                  onChange={(e) => setCouponLink(e.target.value)}
                  placeholder="https://..."
                />
              </div>
            )}

            {/* Campo de Upload */}
            {couponType === 'upload' && (
              <div>
                <Label htmlFor="file">Arquivo do Cupom *</Label>
                <div className="mt-2">
                  {!uploadedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
                    >
                      <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground mb-1">
                        Clique para fazer upload
                      </p>
                      <p className="text-xs text-muted-foreground">
                        JPG, PNG ou PDF (máx. 5MB)
                      </p>
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg p-4">
                      {filePreviewUrl ? (
                        <div className="relative">
                          <img
                            src={filePreviewUrl}
                            alt="Preview"
                            className="w-full h-48 object-contain rounded"
                          />
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="absolute top-2 right-2"
                            onClick={removeFile}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <FileText className="w-8 h-8 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">{uploadedFile.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={removeFile}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
              </div>
            )}

            {/* Datas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Data de Início *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  min={format(new Date(), 'yyyy-MM-dd')}
                />
              </div>

              <div>
                <Label htmlFor="endDate">Data de Término *</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>

            {/* Resumo de Preço */}
            {durationDays > 0 && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Duração total:</span>
                  <span className="font-medium">{durationDays} {durationDays === 1 ? 'dia' : 'dias'}</span>
                </div>
                <div className="flex justify-between text-lg font-bold">
                  <span>Preço total:</span>
                  <span className="text-primary">R$ {price.toFixed(2)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  R$ 4,90 por dia de exibição. Sem limite máximo de duração.
                </p>
              </div>
            )}

            {/* Checkbox de Termos */}
            <div className="flex items-start gap-3 p-4 border border-border rounded-lg">
              <Checkbox
                id="terms"
                checked={acceptedTerms}
                onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
              />
              <div className="space-y-1">
                <Label
                  htmlFor="terms"
                  className="text-sm font-medium leading-none cursor-pointer"
                >
                  Li e aceito os Termos de Publicação de Cupons Pagos do MesaClik *
                </Label>
                <p className="text-xs text-muted-foreground">
                  Ao aceitar, você concorda com a cobrança do valor exibido e assume
                  total responsabilidade pelo conteúdo do cupom.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading || !acceptedTerms || durationDays === 0}
            >
              {loading ? 'Criando cupom...' : 'Criar Cupom (TESTE - Sem Pagamento)'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Termos de Aceitação Geral */}
      <AlertDialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termos de Publicação de Cupons</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Antes de publicar seu primeiro cupom, você precisa aceitar os seguintes termos:</p>
                <ul className="list-disc list-inside space-y-2 text-sm">
                  <li>Os cupons serão exibidos publicamente no aplicativo MesaClik</li>
                  <li>O pagamento é cobrado antecipadamente com base na duração</li>
                  <li>Você é responsável pelo conteúdo e validade dos cupons</li>
                  <li>Os cupons expiram automaticamente na data de término</li>
                  <li>Não há reembolso após a confirmação do pagamento</li>
                  <li>O MesaClik se reserva o direito de remover cupons inadequados</li>
                </ul>
                <p className="text-xs text-muted-foreground mt-4">
                  Este aceite será registrado com data, hora e informações de sua conta.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTermsAccept} disabled={termsLoading}>
              {termsLoading ? 'Processando...' : 'Aceitar e Continuar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}