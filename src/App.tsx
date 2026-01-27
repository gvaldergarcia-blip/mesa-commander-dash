import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Queue from "./pages/Queue";
import Reservations from "./pages/Reservations";
import CustomersPage from "./pages/CustomersPage";
import CustomerProfile from "./pages/CustomerProfile";
import Login from "./pages/Login";
import Promotions from "./pages/Promotions";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Coupons from "./pages/Coupons";
import Intelligence from "./pages/Intelligence";
import NotFound from "./pages/NotFound";
import { FeatureDisabled } from "./components/common/FeatureDisabled";
import { FEATURE_FLAGS } from "./config/feature-flags";

// Páginas da Fila Web (OTP)
import FilaEntrar from "./pages/fila/FilaEntrar";
import FilaVerificar from "./pages/fila/FilaVerificar";
import FilaFinal from "./pages/fila/FilaFinal";

// Páginas Legais (LGPD)
import TermosDeUso from "./pages/legal/TermosDeUso";
import PoliticaPrivacidade from "./pages/legal/PoliticaPrivacidade";

import { useRequireAuth } from "@/hooks/useRequireAuth";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

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

const DashboardRoutes = () => {
  const { loading, isAuthenticated } = useRequireAuth({ redirectTo: "/login" });

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/queue" element={<Queue />} />
        <Route path="/reservations" element={<Reservations />} />
        <Route path="/customers" element={<CustomersPage />} />
        <Route path="/customers/:customerId" element={<CustomerProfile />} />
        {/* Rotas protegidas por feature flag - Cupons/Promoções */}
        <Route
          path="/promotions"
          element={
            <FeatureGuard feature="CUPONS_ENABLED" featureName="Promoções e Marketing">
              <Promotions />
            </FeatureGuard>
          }
        />
        <Route
          path="/cupons"
          element={
            <FeatureGuard feature="CUPONS_ENABLED" featureName="Cupons">
              <Coupons />
            </FeatureGuard>
          }
        />
        <Route path="/reports" element={<Reports />} />
        <Route path="/intelligence" element={<Intelligence />} />
        <Route path="/settings" element={<Settings />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </DashboardLayout>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        {/* Rotas públicas da Fila Web (sem DashboardLayout) */}
        <Route path="/fila/entrar" element={<FilaEntrar />} />
        <Route path="/fila/verificar" element={<FilaVerificar />} />
        <Route path="/fila/final" element={<FilaFinal />} />

        {/* Rotas públicas legais (sem DashboardLayout) */}
        <Route path="/termos" element={<TermosDeUso />} />
        <Route path="/privacidade" element={<PoliticaPrivacidade />} />

        {/* Rotas do painel (exigem login para respeitar RLS) */}
        <Route path="/*" element={<DashboardRoutes />} />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
