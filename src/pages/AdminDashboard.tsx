import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Shield, Users, DollarSign, HardDrive, Crown, Ban,
  LogOut, ChevronDown, Search, ArrowUpRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";

const AdminDashboard = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [confirmDialog, setConfirmDialog] = useState<{ type: string; userId: string; companyId: string } | null>(null);

  // Auth + admin role check
  const { data: isAdmin, isLoading: adminLoading } = useQuery({
    queryKey: ["admin-check"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  useEffect(() => {
    if (!adminLoading && !isAdmin) {
      toast.error("Acesso negado");
      navigate("/");
    }
  }, [adminLoading, isAdmin, navigate]);

  // Fetch all companies with plans
  const { data: companies, isLoading: companiesLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*, user_plans(plan, max_file_size_mb, max_active_requests)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!isAdmin,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { count: totalUsers } = await supabase.from("companies").select("*", { count: "exact", head: true });
      const { count: totalUploads } = await supabase.from("uploads").select("*", { count: "exact", head: true });
      const { data: proPlans } = await supabase.from("user_plans").select("plan").eq("plan", "pro");
      return {
        totalUsers: totalUsers ?? 0,
        proUsers: proPlans?.length ?? 0,
        totalUploads: totalUploads ?? 0,
        mrr: (proPlans?.length ?? 0) * 49,
      };
    },
    enabled: !!isAdmin,
  });

  // Toggle plan mutation
  const togglePlan = useMutation({
    mutationFn: async ({ companyId, newPlan }: { companyId: string; newPlan: string }) => {
      const isPro = newPlan === "pro";
      const { error } = await supabase
        .from("user_plans")
        .update({
          plan: newPlan as any,
          max_file_size_mb: isPro ? 1024 : 50,
          max_active_requests: isPro ? 999 : 5,
          show_watermark: !isPro,
        })
        .eq("company_id", companyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      toast.success("Plano atualizado!");
    },
    onError: (e: any) => toast.error("Erro", { description: e.message }),
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const filtered = companies?.filter((c: any) =>
    c.display_name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  if (adminLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Skeleton className="h-12 w-48" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground">Admin Panel</span>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">Super Admin</Badge>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard Administrativo 🛡️</h1>
          <p className="text-sm text-muted-foreground mb-8">Visão geral do sistema</p>
        </motion.div>

        {/* Stats cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {[
            { label: "MRR", value: `R$${stats?.mrr ?? 0}`, icon: DollarSign, color: "text-success" },
            { label: "Usuários Ativos", value: stats?.totalUsers ?? 0, icon: Users, color: "text-primary" },
            { label: "Planos Pro", value: stats?.proUsers ?? 0, icon: Crown, color: "text-pro" },
            { label: "Arquivos Enviados", value: stats?.totalUploads ?? 0, icon: HardDrive, color: "text-muted-foreground" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-card"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{stat.label}</span>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* User management */}
        <div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
          <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <h2 className="font-semibold text-foreground">Gestão de Usuários 👥</h2>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 rounded-xl"
              />
            </div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Profissional</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Plano</TableHead>
                <TableHead>Criado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companiesLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum usuário encontrado 🤷
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c: any) => {
                  const plan = (Array.isArray(c.user_plans) ? c.user_plans[0]?.plan : c.user_plans?.plan) || "free";
                  return (
                    <TableRow key={c.id} className="group">
                      <TableCell className="font-medium">{c.display_name}</TableCell>
                      <TableCell className="text-muted-foreground font-mono text-xs">/{c.slug}</TableCell>
                      <TableCell>
                        <Badge
                          variant={plan === "pro" ? "default" : "secondary"}
                          className={plan === "pro" ? "gradient-primary text-primary-foreground" : ""}
                        >
                          {plan === "pro" ? "✨ Pro" : "Free"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(c.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              Ações <ChevronDown className="ml-1 h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-xl">
                            <DropdownMenuItem
                              onClick={() => togglePlan.mutate({
                                companyId: c.id,
                                newPlan: plan === "pro" ? "free" : "pro",
                              })}
                            >
                              <Crown className="mr-2 h-4 w-4" />
                              {plan === "pro" ? "Rebaixar para Free" : "Promover para Pro ✨"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => navigate(`/${c.slug}/dashboard`)}
                            >
                              <ArrowUpRight className="mr-2 h-4 w-4" />
                              Ver Dashboard
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
};

export default AdminDashboard;
