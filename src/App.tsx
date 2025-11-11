import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Queue from "./pages/Queue";
import Reservations from "./pages/Reservations";
import Customers from "./pages/Customers";
import Promotions from "./pages/Promotions";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import CheckoutCupom from "./pages/CheckoutCupom";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Rotas de checkout sem DashboardLayout */}
          <Route path="/checkout-cupom" element={<CheckoutCupom />} />
          <Route path="/checkout-success" element={<CheckoutSuccess />} />
          
          {/* Rotas com DashboardLayout */}
          <Route path="/*" element={
            <DashboardLayout>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/queue" element={<Queue />} />
                <Route path="/reservations" element={<Reservations />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/promotions" element={<Promotions />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/settings" element={<Settings />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </DashboardLayout>
          } />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
