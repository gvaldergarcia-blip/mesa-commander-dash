/**
 * Página pública para criar reserva via Link/QR Code.
 * Rota: /reserva/:restaurantId — não requer autenticação.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface RestaurantInfo {
  name: string;
  logo_url: string | null;
  max_party_size: number;
}

export default function ReservaQrEntrar() {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [partySize, setPartySize] = useState('2');
  const [notes, setNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo | null>(null);
  const [validating, setValidating] = useState(true);
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    const fetchInfo = async () => {
      if (!restaurantId) { setInvalid(true); setValidating(false); return; }
      const { data, error } = await supabase.rpc('qr_get_restaurant_info', {
        p_restaurant_id: restaurantId,
      });
      if (error || !data?.success) {
        setInvalid(true);
      } else {
        setRestaurantInfo({
          name: data.name,
          logo_url: data.logo_url,
          max_party_size: data.max_party_size ?? 8,
        });
      }
      setValidating(false);
    };
    fetchInfo();
  }, [restaurantId]);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const minDate = new Date().toISOString().split('T')[0];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !name.trim() || !phone || !date || !time || !termsAccepted) return;

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      toast({ title: 'Telefone inválido', description: 'Use (XX) XXXXX-XXXX', variant: 'destructive' });
      return;
    }

    const reservedFor = new Date(`${date}T${time}`);
    if (reservedFor.getTime() <= Date.now()) {
      toast({ title: 'Data/horário inválidos', description: 'Selecione um horário futuro.', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('create_reservation_panel', {
        p_restaurant_id: restaurantId,
        p_name: name.trim(),
        p_customer_phone: phoneDigits,
        p_customer_email: email.trim() || null,
        p_reserved_for: reservedFor.toISOString(),
        p_party_size: parseInt(partySize, 10),
        p_notes: notes.trim() || null,
      });

      if (error) {
        console.error('Erro ao criar reserva:', error);
        toast({ title: 'Erro ao criar reserva', description: error.message, variant: 'destructive' });
        setLoading(false);
        return;
      }

      const reservationId = (data as any)?.id;
      if (!reservationId) {
        toast({ title: 'Erro inesperado', description: 'Não foi possível confirmar a reserva.', variant: 'destructive' });
        setLoading(false);
        return;
      }

      navigate(`/reserva/final?id=${encodeURIComponent(reservationId)}`, { replace: true });
    } catch (err: any) {
      console.error('Erro:', err);
      toast({ title: 'Erro ao criar reserva', description: err?.message || 'Tente novamente.', variant: 'destructive' });
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Loader2 className="h-8 w-8 animate-spin text-[#F97316]" />
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive">Link inválido</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              O restaurante não foi encontrado ou está inativo. Solicite um novo link ao estabelecimento.
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-background flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader className="text-center space-y-3 pb-2">
          {restaurantInfo?.logo_url ? (
            <img
              src={restaurantInfo.logo_url}
              alt={restaurantInfo.name}
              className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-[#F97316]/20"
            />
          ) : (
            <div className="mx-auto w-14 h-14 bg-[#F97316]/10 rounded-full flex items-center justify-center">
              <Calendar className="h-7 w-7 text-[#F97316]" />
            </div>
          )}
          <div>
            <CardTitle className="text-xl">{restaurantInfo?.name}</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">Reservar mesa</p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input id="name" placeholder="Seu nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="date">Data *</Label>
                <Input id="date" type="date" min={minDate} value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="time">Horário *</Label>
                <Input id="time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="party-size">Quantas pessoas? *</Label>
              <Select value={partySize} onValueChange={setPartySize}>
                <SelectTrigger id="party-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: restaurantInfo?.max_party_size ?? 8 }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} {n === 1 ? 'pessoa' : 'pessoas'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input id="email" type="email" placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input id="notes" placeholder="Ex: aniversário, preferência de mesa..." value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox id="terms" checked={termsAccepted} onCheckedChange={(c) => setTermsAccepted(c === true)} />
              <Label htmlFor="terms" className="text-xs leading-tight cursor-pointer">
                Li e aceito os{' '}
                <Link to="/legal/termos-de-uso" target="_blank" className="text-[#F97316] underline">Termos de Uso</Link>{' '}
                e a{' '}
                <Link to="/legal/politica-de-privacidade" target="_blank" className="text-[#F97316] underline">Política de Privacidade</Link>{' '}
                do MesaClik
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white"
              disabled={loading || !name.trim() || !phone || !date || !time || !termsAccepted}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando reserva...
                </>
              ) : (
                'Solicitar reserva'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4 opacity-60">Powered by MesaClik</p>
    </div>
  );
}
