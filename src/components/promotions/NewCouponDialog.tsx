import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useCoupons } from '@/hooks/useCoupons';
import { useRestaurantTerms } from '@/hooks/useRestaurantTerms';
import { RESTAURANT_ID } from '@/config/current-restaurant';
import { supabase } from '@/lib/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { differenceInDays, format } from 'date-fns';
import { Upload, FileText, Link as LinkIcon, X } from 'lucide-react';

type NewCouponDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function NewCouponDialog({ open, onOpenChange }: NewCouponDialogProps) {
  const { toast } = useToast();
  const { createCoupon } = useCoupons();
  const { termsAccepted, acceptTerms, loading: termsLoading } = useRestaurantTerms();
  
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [couponType, setCouponType] = useState<'link' | 'upload'>('link');
  const [couponLink, setCouponLink] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string>('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState('');
  const [durationDays, setDurationDays] = useState(0);
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
      
      // Nova regra: R$ 2,00 a cada 2 dias, sem limite
      const calculatedPrice = Math.ceil(days / 2) * 2;
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

    await handlePayment();
  };

  const uploadFile = async (): Promise<string | null> => {
    if (!uploadedFile) return null;

    try {
      const fileExt = uploadedFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${RESTAURANT_ID}/${fileName}`;

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

      // Criar cupom com status pendente
      const coupon = await createCoupon({
        restaurant_id: RESTAURANT_ID,
        title: `Cupom ${format(new Date(), 'dd/MM/yyyy HH:mm')}`,
        coupon_type: couponType,
        redeem_link: couponType === 'link' ? couponLink : undefined,
        file_url: fileUrl || undefined,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        duration_days: durationDays,
        price,
        status: 'draft',
        payment_status: 'pending',
        tags: [],
      });

      toast({
        title: 'Cupom criado',
        description: `Aguardando pagamento de R$ ${price.toFixed(2)}`,
      });

      // Aqui você redirecionaria para o checkout
      // Por enquanto, mostramos uma mensagem
      toast({
        title: 'Próximo passo',
        description: 'Você será redirecionado para o pagamento',
      });

      onOpenChange(false);
      resetForm();
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
      await handlePayment();
    }
  };

  const resetForm = () => {
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
                  R$ 2,00 por cada 2 dias de exibição. Sem limite máximo de duração.
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
              {loading ? 'Processando...' : 'Confirmar e Pagar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Termos de Aceitação Geral */}
      <AlertDialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termos de Publicação de Cupons</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
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