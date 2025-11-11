import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useCoupons } from '@/hooks/useCoupons';
import { useRestaurantTerms } from '@/hooks/useRestaurantTerms';
import { RESTAURANT_ID } from '@/config/current-restaurant';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { differenceInDays, addDays, format } from 'date-fns';

type NewCouponDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const DAILY_RATE = 1.2;
const MIN_PRICE = 2.00;
const MAX_PRICE = 100.00;

export function NewCouponDialog({ open, onOpenChange }: NewCouponDialogProps) {
  const { toast } = useToast();
  const { createCoupon } = useCoupons();
  const { termsAccepted, acceptTerms } = useRestaurantTerms();
  
  const [showTermsDialog, setShowTermsDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [linkType, setLinkType] = useState<'link' | 'upload'>('link');
  const [couponLink, setCouponLink] = useState('');
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [durationDays, setDurationDays] = useState(7);
  const [price, setPrice] = useState(8.40);

  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const days = Math.max(1, differenceInDays(end, start));
      setDurationDays(days);
      
      const calculatedPrice = Math.max(MIN_PRICE, Math.min(days * DAILY_RATE, MAX_PRICE));
      setPrice(Math.round(calculatedPrice * 100) / 100);
    }
  }, [startDate, endDate]);

  const handleSubmit = async () => {
    if (!title || !startDate || !endDate) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (linkType === 'link' && !couponLink) {
      toast({
        title: 'Link obrigatório',
        description: 'Forneça o link do cupom',
        variant: 'destructive',
      });
      return;
    }

    if (!termsAccepted) {
      setShowTermsDialog(true);
      return;
    }

    await handlePayment();
  };

  const handlePayment = async () => {
    setLoading(true);
    try {
      // Criar cupom como draft
      const coupon = await createCoupon({
        restaurant_id: RESTAURANT_ID,
        title,
        description,
        discount_type: 'fixed',
        discount_value: 0,
        redeem_link: couponLink,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate).toISOString(),
        duration_days: durationDays,
        price,
        status: 'draft',
        tags: [],
      });

      // Aqui integrar com Stripe Checkout
      toast({
        title: 'Cupom criado',
        description: `Cupom criado como rascunho. Preço: R$ ${price.toFixed(2)}`,
      });

      onOpenChange(false);
      resetForm();
    } catch (error) {
      console.error('Erro ao criar cupom:', error);
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
    setTitle('');
    setDescription('');
    setCouponLink('');
    setStartDate(format(new Date(), 'yyyy-MM-dd'));
    setEndDate(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Novo Cupom Pago</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="title">Título *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: 20% de desconto"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva os detalhes do cupom"
                rows={3}
              />
            </div>

            <div>
              <Label>Tipo de Cupom</Label>
              <div className="flex gap-4 mt-2">
                <Button
                  type="button"
                  variant={linkType === 'link' ? 'default' : 'outline'}
                  onClick={() => setLinkType('link')}
                >
                  Link
                </Button>
                <Button
                  type="button"
                  variant={linkType === 'upload' ? 'default' : 'outline'}
                  onClick={() => setLinkType('upload')}
                  disabled
                >
                  Upload (em breve)
                </Button>
              </div>
            </div>

            {linkType === 'link' && (
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDate">Data de Início *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
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

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duração total:</span>
                <span className="font-medium">{durationDays} dias</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Preço total:</span>
                <span className="text-primary">R$ {price.toFixed(2)}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                R$ {DAILY_RATE.toFixed(2)} por dia (mín: R$ {MIN_PRICE.toFixed(2)}, máx: R$ {MAX_PRICE.toFixed(2)})
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? 'Processando...' : 'Confirmar e Pagar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showTermsDialog} onOpenChange={setShowTermsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Termos de Publicação de Cupons</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Antes de publicar seu primeiro cupom, você precisa aceitar os seguintes termos:</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>Os cupons serão exibidos publicamente no aplicativo MesaClik</li>
                <li>O pagamento é cobrado antecipadamente com base na duração</li>
                <li>Não há reembolso após a publicação</li>
                <li>Os cupons expiram automaticamente na data de término</li>
                <li>Você é responsável pelo conteúdo e validade dos cupons</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleTermsAccept}>
              Aceitar e Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
