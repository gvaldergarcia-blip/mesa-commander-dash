/**
 * Página pública de acompanhamento do Clube MesaClik (Fidelidade)
 * Acessada via link único por token: /clube/:token
 * Mostra progresso de visitas em tempo real, info do restaurante, cardápio e recompensa.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  Trophy,
  Gift,
  MapPin,
  UtensilsCrossed,
  CalendarDays,
  Star,
  ExternalLink,
  CheckCircle2,
  Clock,
  Target,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface LoyaltyData {
  customer: {
    name: string;
    current_visits_raw: number;
  };
  program: {
    name: string;
    required_visits: number;
    reward_description: string;
    reward_validity_days: number;
    reward_unlocked: boolean;
    reward_unlocked_at: string | null;
    reward_expires_at: string | null;
  };
  restaurant: {
    name: string;
    image_url: string | null;
    address: string;
    cuisine: string | null;
    menu_url: string | null;
    about: string | null;
  };
}

export default function ClubeFidelidade() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    document.title = 'Clube MesaClik - Programa de Fidelidade';
  }, []);

  const fetchData = useCallback(async () => {
    if (!token) {
      setError('Link inválido');
      setLoading(false);
      return;
    }

    try {
      const { data: result, error: rpcError } = await supabase.rpc('get_loyalty_tracking', {
        p_token: token,
      });

      if (rpcError) throw rpcError;

      const parsed = typeof result === 'string' ? JSON.parse(result) : result;

      if (!parsed?.success) {
        setError(parsed?.error || 'Programa não encontrado');
        setLoading(false);
        return;
      }

      setData(parsed as LoyaltyData);
      setError(null);
    } catch (err) {
      console.error('Error fetching loyalty data:', err);
      setError('Erro ao carregar dados do programa');
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Initial fetch + polling every 30s for real-time updates
  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 30000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-50/30 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
          <p className="text-muted-foreground">Carregando seu programa...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-50/30 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Programa não encontrado</CardTitle>
            <CardDescription>{error || 'O link pode estar inválido ou o programa foi desativado.'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const { customer, program, restaurant } = data;
  const currentVisits = customer.current_visits_raw;
  const requiredVisits = program.required_visits;
  const remaining = Math.max(0, requiredVisits - currentVisits);
  const progressPct = Math.min(100, (currentVisits / requiredVisits) * 100);

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-amber-50/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Main Card */}
        <Card className="shadow-xl border-0 overflow-hidden">
          {/* Header */}
          <CardHeader className="text-center space-y-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white pb-8 pt-8">
            <Trophy className="h-10 w-10 mx-auto text-yellow-300 drop-shadow" />
            <CardTitle className="text-2xl font-bold text-white">{program.name}</CardTitle>
            {/* Restaurant info */}
            <div className="flex items-center justify-center gap-3 pt-2">
              {restaurant.image_url ? (
                <img
                  src={restaurant.image_url}
                  alt={restaurant.name}
                  className="w-11 h-11 rounded-full object-cover border-2 border-white/40 shadow"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
                  {restaurant.name.charAt(0)}
                </div>
              )}
              <CardDescription className="text-white/90 text-base font-medium">
                {restaurant.name}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6 pt-6 pb-8">
            {/* Greeting */}
            <p className="text-center text-muted-foreground">
              Olá, <span className="font-semibold text-foreground">{customer.name}</span>! 👋
            </p>

            {/* Reward unlocked */}
            {program.reward_unlocked ? (
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-6 text-center border border-green-200 shadow-sm">
                <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-3" />
                <p className="text-green-700 font-bold text-lg">🎉 Parabéns!</p>
                <p className="text-green-600 font-medium mt-1">Você desbloqueou sua recompensa!</p>
                <div className="mt-4 bg-white rounded-lg p-4 border border-green-100">
                  <Gift className="h-5 w-5 mx-auto text-orange-500 mb-2" />
                  <p className="font-semibold text-foreground">{program.reward_description}</p>
                  {program.reward_expires_at && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center justify-center gap-1">
                      <Clock className="h-3 w-3" />
                      Válido até {formatDate(program.reward_expires_at)}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Progress section */}
                <div className="bg-orange-50 rounded-xl p-6 text-center">
                  <p className="text-orange-800 text-sm font-semibold uppercase tracking-wide mb-3">
                    SEU PROGRESSO
                  </p>
                  <div className="flex items-end justify-center gap-1 mb-1">
                    <span className="text-5xl font-extrabold text-orange-500">{currentVisits}</span>
                    <span className="text-xl text-orange-400 font-medium mb-1.5">/ {requiredVisits}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">visitas concluídas</p>

                  {/* Progress bar */}
                  <div className="relative">
                    <Progress value={progressPct} className="h-4 bg-orange-100" />
                    {/* Stars on progress */}
                    <div className="flex justify-between mt-2">
                      {Array.from({ length: requiredVisits }, (_, i) => (
                        <Star
                          key={i}
                          className={`h-3.5 w-3.5 ${
                            i < currentVisits
                              ? 'text-orange-500 fill-orange-500'
                              : 'text-orange-200'
                          }`}
                        />
                      )).slice(0, Math.min(requiredVisits, 15))}
                    </div>
                  </div>
                </div>

                {/* Remaining visits */}
                <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
                  <div className="flex items-center justify-center gap-2 text-amber-700">
                    <Target className="h-5 w-5" />
                    <p className="font-medium">
                      Faltam apenas <span className="font-bold text-orange-600">{remaining}</span>{' '}
                      {remaining === 1 ? 'visita' : 'visitas'}!
                    </p>
                  </div>
                </div>

                {/* Reward preview */}
                <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-5 border border-orange-100">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-orange-100 rounded-lg">
                      <Gift className="h-5 w-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Sua recompensa</p>
                      <p className="text-sm text-orange-700 mt-1">{program.reward_description}</p>
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Validade: {program.reward_validity_days} dias após desbloquear
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Restaurant Info Card */}
        <Card className="shadow-lg border-0">
          <CardContent className="pt-5 pb-5 space-y-4">
            {/* Address */}
            {restaurant.address && (
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">{restaurant.address}</p>
              </div>
            )}

            {/* Cuisine */}
            {restaurant.cuisine && (
              <div className="flex items-center gap-3">
                <UtensilsCrossed className="h-4 w-4 text-orange-500 flex-shrink-0" />
                <Badge variant="secondary" className="text-xs">{restaurant.cuisine}</Badge>
              </div>
            )}

            {/* About */}
            {restaurant.about && (
              <p className="text-sm text-muted-foreground border-t pt-3">{restaurant.about}</p>
            )}

            {/* Menu URL */}
            {restaurant.menu_url && (
              <Button
                variant="outline"
                className="w-full gap-2 border-orange-200 text-orange-600 hover:bg-orange-50"
                asChild
              >
                <a href={restaurant.menu_url} target="_blank" rel="noopener noreferrer">
                  <UtensilsCrossed className="h-4 w-4" />
                  Ver Cardápio
                  <ExternalLink className="h-3 w-3" />
                </a>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* How it works */}
        <Card className="shadow-lg border-0">
          <CardContent className="pt-5 pb-5">
            <p className="font-semibold text-sm mb-3">Como funciona?</p>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-3">
                <span className="bg-orange-100 text-orange-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <p>A cada visita concluída, você acumula <strong className="text-foreground">1 clique</strong>.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-orange-100 text-orange-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <p>Ao completar <strong className="text-foreground">{requiredVisits} visitas</strong>, você desbloqueia sua recompensa.</p>
              </div>
              <div className="flex items-start gap-3">
                <span className="bg-orange-100 text-orange-600 rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <p>Apresente esta tela ao restaurante para resgatar!</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="flex justify-center py-4">
          <img
            src="/images/mesaclik-logo-3d.png"
            alt="MesaClik"
            className="h-8 opacity-60"
          />
        </div>
      </div>
    </div>
  );
}
