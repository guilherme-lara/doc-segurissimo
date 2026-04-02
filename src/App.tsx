import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { HelmetProvider } from "react-helmet-async";
import ErrorBoundary from "@/components/ErrorBoundary";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ChecklistUploadPage from "./pages/ChecklistUploadPage";
import DashboardPage from "./pages/DashboardPage";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

// Imports das Páginas Legais LGPD
import TermosUso from "./pages/TermosUso";
import Politica from "./pages/Politica";

const queryClient = new QueryClient();

/**
 * ARQUITETURA DE ROTAS — Portal Seguríssimo v4
 *
 * /                                → Landing page (conversão B2B)
 * /auth/login                      → Login / Signup
 * /admin/dashboard                 → Painel Admin (role: admin)
 * /termos                          → Termos de Uso (LGPD)
 * /privacidade                     → Política de Privacidade (LGPD)
 * /:slug/enviar/:requestId         → Upload com checklist (link único)
 * /:slug/dashboard                 → Dashboard autenticado
 *
 * NOTA: A estrutura /:slug está preparada para migração
 * futura ao domínio jotatechinfo.com.br
 */

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <ErrorBoundary fallbackMessage="Ocorreu um erro na aplicação">
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth/login" element={<AuthPage />} />
              <Route path="/admin/dashboard" element={<AdminDashboard />} />
              <Route path="/:slug/enviar/:requestId" element={<ChecklistUploadPage />} />
              <Route path="/:slug/dashboard" element={
                <ErrorBoundary fallbackMessage="Erro ao carregar o Dashboard">
                  <DashboardPage />
                </ErrorBoundary>
              } />
              
              {/* Rotas Legais Adicionadas */}
              <Route path="/termos" element={<TermosUso />} />
              <Route path="/privacidade" element={<Politica />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ErrorBoundary>
          <CookieConsentBanner />
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
