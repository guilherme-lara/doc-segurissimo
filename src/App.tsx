import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import Index from "./pages/Index";
import AuthPage from "./pages/AuthPage";
import ChecklistUploadPage from "./pages/ChecklistUploadPage";
import DashboardPage from "./pages/DashboardPage";
import AdminDashboard from "./pages/AdminDashboard";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

/**
 * ARQUITETURA DE ROTAS — Portal Seguríssimo v4
 *
 * /                                → Landing page (conversão B2B)
 * /auth/login                      → Login / Signup
 * /admin/dashboard                 → Painel Admin (role: admin)
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
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<AuthPage />} />
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/:slug/enviar/:requestId" element={<ChecklistUploadPage />} />
            <Route path="/:slug/dashboard" element={<DashboardPage />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
