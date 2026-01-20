import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Queue from "./pages/Queue";
import Reservations from "./pages/Reservations";
import Customers from "./pages/Customers";
import CustomerProfile from "./pages/CustomerProfile";
import Promotions from "./pages/Promotions";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import Coupons from "./pages/Coupons";
import NotFound from "./pages/NotFound";
import { FeatureDisabled } from "./components/common/FeatureDisabled";
import { FEATURE_FLAGS } from "./config/feature-flags";

// Páginas da Fila Web (OTP)
import FilaEntrar from "./pages/fila/FilaEntrar";
import FilaVerificar from "./pages/fila/FilaVerificar";
import FilaFinal from "./pages/fila/FilaFinal";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        {/* Rotas públicas da Fila Web (sem DashboardLayout) */}
        <Route path="/fila/entrar" element={<FilaEntrar />} />
        <Route path="/fila/verificar" element={<FilaVerificar />} />
        <Route path="/fila/final" element={<FilaFinal />} />

        {/* Rotas com DashboardLayout */}
        <Route path="/*" element={
          <DashboardLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/queue" element={<Queue />} />
              <Route path="/reservations" element={<Reservations />} />
              <Route path="/customers" element={<Customers />} />
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
              <Route path="/settings" element={<Settings />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </DashboardLayout>
        } />
      </Routes>
    </BrowserRouter>
  </QueryClientProvider>
);

export default App;
