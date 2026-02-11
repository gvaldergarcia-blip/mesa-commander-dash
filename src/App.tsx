import React, { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useSessionFromUrl } from "@/hooks/useSessionFromUrl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RestaurantProvider } from "@/contexts/RestaurantContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import Dashboard from "./pages/Dashboard";
import Queue from "./pages/Queue";
import Reservations from "./pages/Reservations";
import CustomersPage from "./pages/CustomersPage";
import CustomerProfile from "./pages/CustomerProfile";
import Promotions from "./pages/Promotions";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Coupons from "./pages/Coupons";
import Intelligence from "./pages/Intelligence";

import NotFound from "./pages/NotFound";
import { FeatureDisabled } from "./components/common/FeatureDisabled";
import { FEATURE_FLAGS } from "./config/feature-flags";

// Páginas da Fila Web (OTP) - públicas
import FilaEntrar from "./pages/fila/FilaEntrar";
import FilaVerificar from "./pages/fila/FilaVerificar";
import FilaFinal from "./pages/fila/FilaFinal";

// Página de Reserva (pública)
import ReservaFinal from "./pages/reserva/ReservaFinal";

// Páginas Legais (LGPD)
import TermosDeUso from "./pages/legal/TermosDeUso";
import PoliticaPrivacidade from "./pages/legal/PoliticaPrivacidade";

import { supabase } from "@/integrations/supabase/client";

const queryClient = new QueryClient();

/**
 * Limpa o cache do React Query quando o usuário muda de sessão.
 * Impede que dados de um restaurante apareçam para outro usuário.
 */
function useClearCacheOnUserChange() {
  const prevUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const currentUserId = session?.user?.id ?? null;

      if (event === 'SIGNED_OUT') {
        console.log('[CacheClear] SIGNED_OUT — limpando cache');
        queryClient.clear();
        prevUserIdRef.current = null;
        return;
      }

      if (currentUserId && currentUserId !== prevUserIdRef.current) {
        if (prevUserIdRef.current !== null) {
          console.log('[CacheClear] Usuário mudou — limpando cache');
          queryClient.clear();
        }
        prevUserIdRef.current = currentUserId;
      }
    });

    return () => subscription.unsubscribe();
  }, []);
}

// Componente wrapper para rotas que requerem feature flags
const FeatureGuard = ({ 
  feature, 
  children, 
  featureName 
}: { 
  feature: keyof typeof FEATURE_FLAGS; 
  children: React.ReactNode;
  featureName: string;
}) => {
  if (!FEATURE_FLAGS[feature]) {
    return <FeatureDisabled featureName={featureName} />;
  }
  return <>{children}</>;
};

const App = () => {
  // Restaurar sessão de tokens passados via URL pelo site institucional
  useSessionFromUrl();
  // Limpar cache React Query ao trocar de usuário
  useClearCacheOnUserChange();

  return (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas da Fila Web (sem autenticação, sem DashboardLayout) */}
        <Route path="/fila/entrar" element={<FilaEntrar />} />
        <Route path="/fila/verificar" element={<FilaVerificar />} />
        <Route path="/fila/final" element={<FilaFinal />} />

        {/* Rota pública de Reserva */}
        <Route path="/reserva/final" element={<ReservaFinal />} />
        
        {/* Rotas públicas legais (sem DashboardLayout) */}
        <Route path="/termos" element={<TermosDeUso />} />
        <Route path="/privacidade" element={<PoliticaPrivacidade />} />

        {/* Rotas protegidas do painel - REQUEREM AUTENTICAÇÃO */}
        <Route path="/*" element={
          <RestaurantProvider>
            <ProtectedRoute>
              <DashboardLayout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/queue" element={<Queue />} />
                  <Route path="/reservations" element={<Reservations />} />
                  <Route path="/customers" element={<CustomersPage />} />
                  <Route path="/customers/:customerId" element={<CustomerProfile />} />
                  {/* Rotas protegidas por feature flag - Cupons/Promoções */}
                  <Route path="/promotions" element={
                    <FeatureGuard feature="CUPONS_ENABLED" featureName="Promoções e Marketing">
                      <Promotions />
                    </FeatureGuard>
                  } />
                  <Route path="/cupons" element={
                    <FeatureGuard feature="CUPONS_ENABLED" featureName="Cupons">
                      <Coupons />
                    </FeatureGuard>
                  } />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/intelligence" element={<Intelligence />} />
                  <Route path="/settings" element={<Settings />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </DashboardLayout>
            </ProtectedRoute>
          </RestaurantProvider>
        } />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
  );
};

export default App;
