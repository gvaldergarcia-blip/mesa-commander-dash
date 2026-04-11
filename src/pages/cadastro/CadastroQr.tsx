/**
 * Página pública de cadastro via QR Code
 * Rota: /cadastro/:restaurantId
 * NÃO requer autenticação
 */
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, UserPlus, CheckCircle2 } from 'lucide-react';

interface RestaurantInfo {
  name: string;
  logo_url: string | null;
}

export default function CadastroQr() {
  const { restaurantId } = useParams<{ restaurantId: string }>();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthday, setBirthday] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [marketingOptin, setMarketingOptin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
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
        setRestaurantInfo({ name: data.name, logo_url: data.logo_url });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId || !name.trim() || !phone || !termsAccepted) return;

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) return;

    setLoading(true);
    try {
      const rpcParams = {
        p_restaurant_id: restaurantId,
        p_name: name.trim(),
        p_phone: phoneDigits,
        p_marketing_optin: marketingOptin,
        p_terms_accepted: termsAccepted,
        p_email: email.trim() || null,
        p_birthday: birthday || null,
      };

      const { data, error } = await supabase.rpc('qr_register_customer', rpcParams as any);

      if (error || !data?.success) {
        console.error('Erro ao cadastrar:', error || data?.error);
        alert(data?.error || 'Erro ao realizar cadastro. Tente novamente.');
        setLoading(false);
        return;
      }

      setSuccess(true);
    } catch (err) {
      console.error('Erro:', err);
      alert('Erro ao realizar cadastro. Tente novamente.');
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
            <CardTitle className="text-destructive">QR Code inválido</CardTitle>
            <p className="text-sm text-muted-foreground mt-2">
              O restaurante não foi encontrado ou está inativo. Solicite um novo QR Code ao estabelecimento.
            </p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg border-0 text-center">
          <CardHeader className="space-y-4">
            {restaurantInfo?.logo_url ? (
              <img
                src={restaurantInfo.logo_url}
                alt={restaurantInfo.name}
                className="w-20 h-20 rounded-full object-cover mx-auto border-2 border-[#F97316]/20"
              />
            ) : null}
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-9 w-9 text-green-600" />
            </div>
            <CardTitle className="text-xl">Cadastro realizado com sucesso!</CardTitle>
            <p className="text-muted-foreground text-sm">
              Bem-vindo ao clube de clientes do <strong>{restaurantInfo?.name}</strong>.
            </p>
          </CardHeader>
        </Card>
        <p className="text-xs text-muted-foreground mt-4 opacity-60">Powered by MesaClik</p>
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
              <UserPlus className="h-7 w-7 text-[#F97316]" />
            </div>
          )}
          <div>
            <CardTitle className="text-xl">{restaurantInfo?.name}</CardTitle>
            <p className="text-muted-foreground text-sm mt-1">Cadastre-se como cliente</p>
          </div>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
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

            <div className="space-y-2">
              <Label htmlFor="email">E-mail <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthday">Data de aniversário <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Input
                id="birthday"
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
              />
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="terms"
                checked={termsAccepted}
                onCheckedChange={(checked) => setTermsAccepted(checked === true)}
              />
              <Label htmlFor="terms" className="text-xs leading-tight cursor-pointer">
                Li e aceito os{' '}
                <Link to="/legal/termos-de-uso" target="_blank" className="text-[#F97316] underline">
                  Termos de Uso
                </Link>{' '}
                e a{' '}
                <Link to="/legal/politica-de-privacidade" target="_blank" className="text-[#F97316] underline">
                  Política de Privacidade
                </Link>{' '}
                do MesaClik
              </Label>
            </div>

            <div className="flex items-start space-x-2">
              <Checkbox
                id="marketing"
                checked={marketingOptin}
                onCheckedChange={(checked) => setMarketingOptin(checked === true)}
              />
              <Label htmlFor="marketing" className="text-xs leading-tight cursor-pointer">
                Quero receber promoções e novidades do restaurante
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#F97316] hover:bg-[#EA580C] text-white"
              disabled={loading || !name.trim() || !phone || !termsAccepted}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                'Concluir cadastro'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground mt-4 opacity-60">Powered by MesaClik</p>
    </div>
  );
}
