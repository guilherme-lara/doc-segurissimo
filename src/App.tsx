import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import UploadPage from "./pages/UploadPage";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * ARQUITETURA DE ROTAS — Portal Seguríssimo
 * 
 * /                         → Página inicial (landing)
 * /:slug/enviar             → Área pública de upload (white-label por empresa)
 * /:slug/login              → Login do profissional
 * /:slug/dashboard          → Dashboard autenticado do profissional
 * 
 * NOTA: A estrutura /:slug já está preparada para migração 
 * futura ao domínio jotatechinfo.com.br
 */

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/:slug/enviar" element={<UploadPage />} />
          <Route path="/:slug/login" element={<LoginPage />} />
          <Route path="/:slug/dashboard" element={<DashboardPage />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
