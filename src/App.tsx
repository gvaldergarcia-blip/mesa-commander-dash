import React, { useEffect, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { useSessionFromUrl } from "@/hooks/useSessionFromUrl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { RestaurantProvider } from "@/contexts/RestaurantContext";
import { ModulesProvider, useModules } from "@/contexts/ModulesContext";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { ModuleGuard } from "@/components/layout/ModuleGuard";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { MODULES_BY_KEY } from "@/config/modules";
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
import VideoGenerator from "./pages/VideoGenerator";
import IACreatorMarketing from "./pages/IACreatorMarketing";
import ChecklistsPage from "./pages/ChecklistsPage";
import ChecklistQrValidate from "./pages/ChecklistQrValidate";
import EtiquetasPage from "./pages/EtiquetasPage";
import EtiquetaScan from "./pages/EtiquetaScan";


import NotFound from "./pages/NotFound";
import { FeatureDisabled } from "./components/common/FeatureDisabled";
import { FEATURE_FLAGS } from "./config/feature-flags";

// Páginas da Fila Web (OTP) - públicas
import FilaEntrar from "./pages/fila/FilaEntrar";
import FilaVerificar from "./pages/fila/FilaVerificar";
import FilaFinal from "./pages/fila/FilaFinal";
import FilaQrEntrar from "./pages/fila/FilaQrEntrar";

// Página de Cadastro via QR (pública)
import CadastroQr from "./pages/cadastro/CadastroQr";

// Página de Reserva (pública)
import ReservaFinal from "./pages/reserva/ReservaFinal";
import ReservaQrEntrar from "./pages/reserva/ReservaQrEntrar";

// Páginas Legais (LGPD)
import TermosDeUso from "./pages/legal/TermosDeUso";
import PoliticaPrivacidade from "./pages/legal/PoliticaPrivacidade";

// Redirect rotas antigas
// import { Navigate } from "react-router-dom";

// Rotas públicas marketing (sem DashboardLayout)
import MarketingOptIn from "./pages/marketing/MarketingOptIn";
import MarketingUnsubscribe from "./pages/marketing/MarketingUnsubscribe";

// Clube MesaClik (público)
import ClubeFidelidade from "./pages/clube/ClubeFidelidade";

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

/**
 * Redireciona a raiz do painel para o único módulo contratado,
 * ou para o dashboard quando há vários módulos.
 */
function HomeRedirect() {
  const { isLoading, homeModule, modules } = useModules();

  if (isLoading) return null;

  // Se só existe um módulo contratado (ex: apenas etiquetas), vai direto para ele.
  const contractable = modules.filter((m) => m !== 'dashboard');
  if (contractable.length === 1 && homeModule) {
    const target = MODULES_BY_KEY[homeModule]?.href;
    if (target) return <Navigate to={target} replace />;
  }

  return <Navigate to="/dashboard" replace />;
}

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
        <Route path="/fila/qr/:restaurantId" element={<FilaQrEntrar />} />
        <Route path="/fila/:restaurantId" element={<FilaQrEntrar />} />

        {/* Rota pública de Cadastro via QR */}
        <Route path="/cadastro/:restaurantId" element={<CadastroQr />} />

        {/* Rota pública de Reserva */}
        <Route path="/reserva/final" element={<ReservaFinal />} />
        <Route path="/reserva/:restaurantId" element={<ReservaQrEntrar />} />

        {/* Rotas públicas legais (sem DashboardLayout) */}
        <Route path="/legal/termos-de-uso" element={<TermosDeUso />} />
        <Route path="/legal/politica-de-privacidade" element={<PoliticaPrivacidade />} />
        {/* Redirect rotas antigas */}
        <Route path="/termos" element={<Navigate to="/legal/termos-de-uso" replace />} />
        <Route path="/privacidade" element={<Navigate to="/legal/politica-de-privacidade" replace />} />

        {/* Rotas públicas marketing (sem DashboardLayout) */}
        <Route path="/marketing/optin" element={<MarketingOptIn />} />
        <Route path="/marketing/unsubscribe" element={<MarketingUnsubscribe />} />

        {/* Clube MesaClik - acompanhamento público de fidelidade */}
        <Route path="/clube/:token" element={<ClubeFidelidade />} />
        <Route path="/marketing/unsubscribe" element={<MarketingUnsubscribe />} />

        {/* Validação pública de QR do checklist (sem login, sem DashboardLayout) */}
        <Route path="/checklists/scan/:itemId" element={<ChecklistQrValidate />} />

        {/* Validação pública de QR de etiqueta (sem login) */}
        <Route path="/etiquetas/scan/:code" element={<EtiquetaScan />} />

        {/* Rotas protegidas do painel - REQUEREM AUTENTICAÇÃO */}
        <Route path="/*" element={
          <RestaurantProvider>
            <ModulesProvider>
              <ProtectedRoute>
                <DashboardLayout>
                  <Routes>
                    <Route path="/" element={<HomeRedirect />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/queue" element={
                      <ModuleGuard module="fila"><Queue /></ModuleGuard>
                    } />
                    <Route path="/reservations" element={
                      <ModuleGuard module="reservas"><Reservations /></ModuleGuard>
                    } />
                  <Route path="/customers" element={
                    <ModuleGuard module="clientes">
                      <RoleGuard><CustomersPage /></RoleGuard>
                    </ModuleGuard>
                  } />
                  <Route path="/customers/:customerId" element={
                    <ModuleGuard module="clientes">
                      <RoleGuard><CustomerProfile /></RoleGuard>
                    </ModuleGuard>
                  } />
                  {/* Rotas protegidas por feature flag - Cupons/Promoções */}
                  <Route path="/promotions" element={
                    <ModuleGuard module="promocoes">
                      <RoleGuard>
                        <FeatureGuard feature="CUPONS_ENABLED" featureName="Promoções e Marketing">
                          <Promotions />
                        </FeatureGuard>
                      </RoleGuard>
                    </ModuleGuard>
                  } />
                  <Route path="/cupons" element={
                    <ModuleGuard module="promocoes">
                      <RoleGuard>
                        <FeatureGuard feature="CUPONS_ENABLED" featureName="Cupons">
                          <Coupons />
                        </FeatureGuard>
                      </RoleGuard>
                    </ModuleGuard>
                  } />
                  <Route path="/reports" element={
                    <ModuleGuard module="relatorios">
                      <RoleGuard><Reports /></RoleGuard>
                    </ModuleGuard>
                  } />
                  <Route path="/intelligence" element={
                    <ModuleGuard module="relatorios">
                      <RoleGuard><Intelligence /></RoleGuard>
                    </ModuleGuard>
                  } />
                  <Route path="/marketing/video" element={
                    <ModuleGuard module="marketing_ia">
                      <RoleGuard>
                        <FeatureGuard feature="MARKETING_IA_ENABLED" featureName="Marketing IA">
                          <VideoGenerator />
                        </FeatureGuard>
                      </RoleGuard>
                    </ModuleGuard>
                  } />
                  <Route path="/marketing/creator" element={
                    <ModuleGuard module="studio">
                      <RoleGuard>
                        <IACreatorMarketing />
                      </RoleGuard>
                    </ModuleGuard>
                  } />
                  <Route path="/checklists" element={
                    <ModuleGuard module="checklist"><ChecklistsPage /></ModuleGuard>
                  } />
                  <Route path="/etiquetas" element={
                    <ModuleGuard module="etiquetas"><EtiquetasPage /></ModuleGuard>
                  } />
                  <Route path="/settings" element={
                    <RoleGuard><Settings /></RoleGuard>
                  } />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </DashboardLayout>
              </ProtectedRoute>
            </ModulesProvider>
          </RestaurantProvider>
        } />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
  );
};

export default App;
