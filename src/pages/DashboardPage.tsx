/**
 * DashboardPage — Painel do profissional (v4)
 *
 * Features:
 * - View modes: Lista / Kanban
 * - Tabs de filtro (Todos / Pendentes / Aprovados / Rejeitados)
 * - Busca rápida por nome de arquivo ou cliente
 * - Agrupamento por etapas com Accordions
 * - Preview modal de arquivos com Aprovar/Rejeitar(+motivo)/Baixar
 * - Audit log timeline (PRO)
 * - Color picker de branding (PRO)
 * - OwnCloud Sync (PRO - WebDAV)
 * - Lembrete Mágico via WhatsApp (PRO)
 * - Senha de acesso no link (PRO)
 * - Link com expiração (PRO)
 * - Campos de texto no checklist
 * - Branding: Logo URL, CNPJ, Telefone, Cor (PRO)
 *
 * NOTA para migração:
 * - Signed URLs via supabase.storage.createSignedUrl (substituir por endpoint próprio)
 * - RLS policies documentadas em cada migration
 * - document_requests.access_password: senha em texto simples (migrar para hash em produção)
 * - OwnCloud WebDAV: credenciais em companies.owncloud_url/user/token
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Shield, Copy, Check, Download, FileText, Settings, LogOut,
  Link as LinkIcon, Plus, Trash2, Tag, Sparkles, Crown, Lock as LockIcon,
  Search, Cloud, Palette, Filter, MessageCircle, Phone, Building2,
  Archive, Loader2, LayoutList, Kanban, Clock, Type
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import FilePreviewModal from "@/components/dashboard/FilePreviewModal";
import AuditLogTimeline from "@/components/dashboard/AuditLogTimeline";
import KanbanView from "@/components/dashboard/KanbanView";
import { ThemeToggle } from "@/components/ThemeToggle";

// ─── Pre-defined document tags ───
const COMMON_DOCUMENTS: { label: string; stage: string }[] = [
  { label: "RG / CNH", stage: "Documentos Pessoais" },
  { label: "CPF", stage: "Documentos Pessoais" },
  { label: "Comprovante de Residência", stage: "Documentos Pessoais" },
  { label: "Contrato Social", stage: "Documentos Empresariais" },
  { label: "Cartão CNPJ", stage: "Documentos Empresariais" },
  { label: "Extrato Bancário", stage: "Documentos Financeiros" },
  { label: "Holerite / Contracheque", stage: "Documentos Financeiros" },
  { label: "Declaração de IR", stage: "Documentos Financeiros" },
  { label: "Certidão de Casamento", stage: "Documentos Pessoais" },
  { label: "Certidão de Nascimento", stage: "Documentos Pessoais" },
];

const TEMPLATES: { name: string; emoji: string; items: { label: string; stage: string }[] }[] = [
  {
    name: "Kit Admissão",
    emoji: "📋",
    items: [
      { label: "RG / CNH", stage: "Documentos Pessoais" },
      { label: "CPF", stage: "Documentos Pessoais" },
      { label: "Comprovante de Residência", stage: "Documentos Pessoais" },
    ],
  },
  {
    name: "Kit Abertura PJ",
    emoji: "🏢",
    items: [
      { label: "RG / CNH", stage: "Documentos Pessoais" },
      { label: "CPF", stage: "Documentos Pessoais" },
      { label: "Comprovante de Residência", stage: "Documentos Pessoais" },
      { label: "Contrato Social", stage: "Documentos Empresariais" },
      { label: "Cartão CNPJ", stage: "Documentos Empresariais" },
    ],
  },
];

interface ChecklistItem {
  stageName: string;
  itemName: string;
  itemType: "file" | "text";
}

const DashboardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [downloadingZipId, setDownloadingZipId] = useState<string | null>(null);

  // View mode
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");

  // New request dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [customItemName, setCustomItemName] = useState("");
  const [customItemType, setCustomItemType] = useState<"file" | "text">("file");
  const [passwordProtect, setPasswordProtect] = useState(false);
  const [accessPassword, setAccessPassword] = useState("");
  const [linkExpiration, setLinkExpiration] = useState(false);
  const [expirationDays, setExpirationDays] = useState(7);

  // Pro upgrade modal
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  // Cloud sync modal (OwnCloud)
  const [cloudSyncModalOpen, setCloudSyncModalOpen] = useState(false);

  // File preview modal
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Files tab filter + search
  const [fileFilter, setFileFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Audit log panel
  const [auditRequestId, setAuditRequestId] = useState<string | null>(null);

  // Branding
  const [brandColor, setBrandColor] = useState("#7c3aed");
  const [logoUrl, setLogoUrl] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [phone, setPhone] = useState("");

  // OwnCloud config
  const [owncloudUrl, setOwncloudUrl] = useState("");
  const [owncloudUser, setOwncloudUser] = useState("");
  const [owncloudToken, setOwncloudToken] = useState("");

  // Auth check
  const { data: session } = useQuery({
    queryKey: ["session"],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) navigate("/auth/login");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  // Fetch company
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["company", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  useEffect(() => {
    if (company) {
      setBrandColor(company.primary_color ?? "#7c3aed");
      setLogoUrl(company.logo_url ?? "");
      setCnpj((company as any).cnpj ?? "");
      setPhone((company as any).phone ?? "");
      setOwncloudUrl((company as any).owncloud_url ?? "");
      setOwncloudUser((company as any).owncloud_user ?? "");
      setOwncloudToken((company as any).owncloud_token ?? "");
    }
  }, [company]);

  // Fetch plan
  const { data: plan } = useQuery({
    queryKey: ["plan", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_plans")
        .select("*")
        .eq("company_id", company!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!company?.id,
  });

  const isPro = plan?.plan === "pro";

  // Fetch requests with items
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ["requests", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requests")
        .select("*, request_items(id, item_name, stage_name, is_completed, sort_order)")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!company?.id,
  });

  // Fetch uploads
  const { data: uploads, isLoading: uploadsLoading } = useQuery({
    queryKey: ["uploads", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploads")
        .select("*, request_items!inner(item_name, stage_name, request_id, document_requests:request_id(client_name))")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) {
        const { data: fallback } = await supabase
          .from("uploads")
          .select("*")
          .eq("company_id", company!.id)
          .order("created_at", { ascending: false });
        return fallback ?? [];
      }
      return data;
    },
    enabled: !!company?.id,
  });

  // Realtime: listen for uploads changes to update dashboard instantly
  useEffect(() => {
    if (!company?.id) return;

    console.log("[dashboard-realtime] Subscribing to uploads & request_items for company:", company.id);

    const channel = supabase
      .channel(`dashboard-${company.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "uploads", filter: `company_id=eq.${company.id}` },
        (payload) => {
          console.log("[dashboard-realtime] uploads change:", payload.eventType, (payload.new as any)?.status);
          queryClient.invalidateQueries({ queryKey: ["uploads", company.id] });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "request_items" },
        () => {
          console.log("[dashboard-realtime] request_items change detected");
          queryClient.invalidateQueries({ queryKey: ["requests", company.id] });
        }
      )
      .subscribe((status) => {
        console.log("[dashboard-realtime] Subscription status:", status);
      });

    return () => {
      console.log("[dashboard-realtime] Unsubscribing");
      supabase.removeChannel(channel);
    };
  }, [company?.id, queryClient]);

  // Settings state
  const [displayName, setDisplayName] = useState("");
  const [slugValue, setSlugValue] = useState("");

  useEffect(() => {
    if (company) {
      setDisplayName(company.display_name);
      setSlugValue(company.slug);
    }
  }, [company]);

  // ─── Tag-based checklist management ───
  const addDocumentTag = (label: string, stage: string) => {
    if (checklistItems.some((i) => i.itemName === label)) return;
    setChecklistItems([...checklistItems, { stageName: stage, itemName: label, itemType: "file" }]);
  };

  const removeDocumentTag = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const applyTemplate = (template: typeof TEMPLATES[number]) => {
    const merged = [...checklistItems];
    template.items.forEach((t) => {
      if (!merged.some((m) => m.itemName === t.label)) {
        merged.push({ stageName: t.stage, itemName: t.label, itemType: "file" });
      }
    });
    setChecklistItems(merged);
    toast.success(`Template "${template.name}" aplicado 🎉`);
  };

  const addCustomItem = () => {
    const name = customItemName.trim();
    if (!name) return;
    if (checklistItems.some((i) => i.itemName === name)) {
      toast.warning("Documento já adicionado");
      return;
    }
    setChecklistItems([...checklistItems, { stageName: "Outros", itemName: name, itemType: customItemType }]);
    setCustomItemName("");
  };

  const activeRequestCount = requests?.filter((r: any) => r.status !== "completed").length ?? 0;
  const maxRequests = plan?.max_active_requests ?? 5;

  // Create request mutation
  const createRequest = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("No company");
      if (!clientName.trim() || checklistItems.length === 0) throw new Error("Preencha o nome e adicione pelo menos um documento");
      if (!isPro && activeRequestCount >= maxRequests) {
        throw new Error(`Limite de ${maxRequests} solicitações ativas atingido. Faça upgrade para Pro! ✨`);
      }

      const insertData: any = {
        company_id: company.id,
        client_name: clientName,
        client_email: clientEmail || null,
      };

      if (isPro && passwordProtect && accessPassword.trim()) {
        insertData.access_password = accessPassword.trim();
      }

      // Link expiration (PRO)
      if (isPro && linkExpiration && expirationDays > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expirationDays);
        insertData.expires_at = expiresAt.toISOString();
        console.log("[create-request] Link expires at:", insertData.expires_at);
      }

      console.log("[create-request] Creating request:", insertData);
      const { data: req, error: reqError } = await supabase
        .from("document_requests")
        .insert(insertData)
        .select()
        .single();
      if (reqError) throw reqError;

      const items = checklistItems.map((item, i) => ({
        request_id: req.id,
        stage_name: item.stageName,
        item_name: item.itemName,
        sort_order: i,
        item_type: item.itemType,
      }));
      console.log("[create-request] Creating items:", items);
      const { error: itemsError } = await supabase.from("request_items").insert(items);
      if (itemsError) throw itemsError;
      return req;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setDialogOpen(false);
      setClientName("");
      setClientEmail("");
      setChecklistItems([]);
      setPasswordProtect(false);
      setAccessPassword("");
      setLinkExpiration(false);
      setExpirationDays(7);
      toast.success("Solicitação criada com sucesso! 🎉");
    },
    onError: (err: any) => {
      if (err.message.includes("Limite")) setUpgradeModalOpen(true);
      toast.error("Erro ao criar solicitação", { description: err.message });
    },
  });

  // Update settings (includes OwnCloud config)
  const updateSettings = useMutation({
    mutationFn: async () => {
      if (!company) return;
      const updateData: any = {
        display_name: displayName,
        slug: slugValue,
        primary_color: brandColor,
        logo_url: logoUrl || null,
        cnpj: cnpj || null,
        phone: phone || null,
      };
      // OwnCloud config (PRO only)
      if (isPro) {
        updateData.owncloud_url = owncloudUrl || null;
        updateData.owncloud_user = owncloudUser || null;
        updateData.owncloud_token = owncloudToken || null;
      }
      console.log("[settings] Saving:", updateData);
      const { error } = await supabase
        .from("companies")
        .update(updateData)
        .eq("id", company.id);
      if (error) throw error;
      if (slugValue !== slug) navigate(`/${slugValue}/dashboard`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success("Configurações salvas! ✅");
    },
  });

  const handleCopy = (requestId: string) => {
    const link = `${window.location.origin}/${slug}/enviar/${requestId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(requestId);
    toast.success("Link copiado! 📋");
    setTimeout(() => setCopiedId(null), 2000);
  };

  // WhatsApp Magic Reminder
  const handleMagicReminder = (req: any) => {
    if (!isPro) {
      setUpgradeModalOpen(true);
      return;
    }

    const allItems = req.request_items ?? [];
    const requestUploads = uploads?.filter((u: any) =>
      allItems.some((item: any) => item.id === u.request_item_id)
    ) ?? [];

    const pendingItems = allItems.filter((item: any) => {
      const upload = requestUploads.find((u: any) => u.request_item_id === item.id);
      if (!upload) return true;
      return upload.status === "pending" || upload.status === "rejected";
    });

    if (pendingItems.length === 0) {
      toast.info("Todos os documentos já foram enviados! 🎉");
      return;
    }

    const docList = pendingItems.map((item: any) => `• ${item.item_name}`).join("\n");
    const link = `${window.location.origin}/${slug}/enviar/${req.id}`;
    const message = `Olá! 👋 Passando para lembrar que ainda aguardamos o envio dos seguintes documentos:\n\n${docList}\n\nAcesse seu link seguro para enviar: ${link}`;
    const encoded = encodeURIComponent(message);

    const clientPhone = req.client_email?.replace(/\D/g, "") ?? "";
    const waUrl = clientPhone
      ? `https://wa.me/${clientPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(waUrl, "_blank");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleDownloadZip = useCallback(async (requestId: string, clientNameArg: string) => {
    setDownloadingZipId(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      console.log("[download-zip] Starting for request:", requestId);
      toast.info("Gerando ZIP... aguarde ⏳");

      // Use raw fetch to preserve binary data — supabase.functions.invoke
      // parses as JSON by default, corrupting the ZIP bytes
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const functionUrl = `https://${projectId}.supabase.co/functions/v1/download-zip`;
      console.log("[download-zip] Calling:", functionUrl);

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ requestId }),
      });

      console.log("[download-zip] Response status:", response.status, response.headers.get("content-type"));

      if (!response.ok) {
        const errorBody = await response.text();
        console.error("[download-zip] Error body:", errorBody);
        let errorMsg = "Erro ao gerar ZIP";
        try {
          const parsed = JSON.parse(errorBody);
          errorMsg = parsed.error || errorMsg;
        } catch { /* not JSON */ }
        toast.error(errorMsg);
        return;
      }

      const blob = await response.blob();
      console.log("[download-zip] ✅ Blob received, size:", blob.size, "type:", blob.type);

      if (blob.size === 0) {
        toast.error("ZIP vazio — nenhum arquivo aprovado encontrado");
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${clientNameArg} - Aprovados.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Download concluído! 📦");
    } catch (err: any) {
      console.error("[download-zip] Exception:", err);
      toast.error("Erro ao baixar ZIP", { description: err.message });
    } finally {
      setDownloadingZipId(null);
    }
  }, []);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("pt-BR");

  // Filter uploads
  const filteredUploads = uploads?.filter((file: any) => {
    const matchesFilter = fileFilter === "all" || file.status === fileFilter;
    const query = searchQuery.toLowerCase();
    const matchesSearch = !query ||
      file.file_name?.toLowerCase().includes(query) ||
      file.request_items?.document_requests?.client_name?.toLowerCase().includes(query) ||
      file.request_items?.item_name?.toLowerCase().includes(query);
    return matchesFilter && matchesSearch;
  }) ?? [];

  // Group uploads by stage
  const uploadsByStage = filteredUploads.reduce<Record<string, any[]>>((acc, file: any) => {
    const stage = file.request_items?.stage_name ?? "Geral";
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(file);
    return acc;
  }, {});

  const pendingCount = uploads?.filter((f: any) => f.status === "pending").length ?? 0;
  const approvedCount = uploads?.filter((f: any) => f.status === "approved").length ?? 0;
  const rejectedCount = uploads?.filter((f: any) => f.status === "rejected").length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="glass sticky top-0 z-50 border-b border-border/40">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground">Seguríssimo</span>
            {isPro && (
              <Badge variant="outline" className="text-xs border-pro/40 text-pro">
                <Crown className="mr-1 h-3 w-3" /> Pro
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground transition-colors" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between"
        >
          <div>
            {companyLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <>
                <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                <p className="text-sm text-muted-foreground">
                  Gerencie suas solicitações · {!isPro && <span className="text-primary cursor-pointer hover:underline" onClick={() => setUpgradeModalOpen(true)}>Upgrade para Pro ✨</span>}
                </p>
              </>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Cloud Sync (PRO) */}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl transition-all duration-200"
              onClick={() => isPro ? setCloudSyncModalOpen(true) : setUpgradeModalOpen(true)}
            >
              {!isPro && <LockIcon className="mr-1.5 h-3 w-3" />}
              <Cloud className="mr-1.5 h-3 w-3" />
              ownCloud
            </Button>
            {/* Create request */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300">
                  <Plus className="mr-2 h-4 w-4" /> Criar Solicitação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl">
                <DialogHeader>
                  <DialogTitle>Nova Solicitação 📄</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 mt-4">
                  <div className="space-y-2">
                    <Label>Nome do Cliente</Label>
                    <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex: João Silva" className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label>E-mail / WhatsApp do Cliente (opcional)</Label>
                    <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="cliente@email.com ou 5514999..." type="text" className="rounded-xl" />
                  </div>

                  {/* Templates */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Templates Prontos</Label>
                    <div className="flex flex-wrap gap-2">
                      {TEMPLATES.map((tpl) => (
                        <Button key={tpl.name} variant="outline" size="sm" onClick={() => applyTemplate(tpl)} type="button" className="rounded-xl hover:bg-accent hover:text-accent-foreground transition-all duration-200">
                          {tpl.emoji} {tpl.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Document tags */}
                  <div className="space-y-2">
                    <Label>Documentos Comuns</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_DOCUMENTS.map((doc) => {
                        const isAdded = checklistItems.some((i) => i.itemName === doc.label);
                        return (
                          <button
                            key={doc.label}
                            type="button"
                            onClick={() => addDocumentTag(doc.label, doc.stage)}
                            disabled={isAdded}
                            className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                              isAdded
                                ? "border-primary/30 bg-primary/10 text-primary cursor-default"
                                : "border-border bg-card text-foreground hover:border-primary hover:bg-accent cursor-pointer hover:scale-[1.02]"
                            }`}
                          >
                            {isAdded && <Check className="mr-1 h-3 w-3" />}
                            {doc.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Custom document with type selector */}
                  <div className="space-y-2">
                    <Label>Adicionar Item Personalizado</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder={customItemType === "text" ? "Ex: Qual seu CPF?" : "Nome do documento..."}
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomItem())}
                        className="rounded-xl"
                      />
                      <Button
                        variant={customItemType === "text" ? "default" : "outline"}
                        size="icon"
                        onClick={() => setCustomItemType(customItemType === "file" ? "text" : "file")}
                        type="button"
                        className="rounded-xl shrink-0"
                        title={customItemType === "text" ? "Campo de texto" : "Upload de arquivo"}
                      >
                        {customItemType === "text" ? <Type className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </Button>
                      <Button variant="outline" size="icon" onClick={addCustomItem} type="button" className="rounded-xl shrink-0">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {customItemType === "text" ? "📝 Campo de texto — o cliente digitará a resposta" : "📎 Upload de arquivo — o cliente enviará um documento"}
                    </p>
                  </div>

                  {/* Selected items */}
                  {checklistItems.length > 0 && (
                    <div className="space-y-2">
                      <Label>Itens selecionados ({checklistItems.length})</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {checklistItems.map((item, i) => (
                          <Badge key={i} variant="secondary" className="gap-1 pr-1 rounded-full">
                            {item.itemType === "text" ? "📝" : "📎"} {item.itemName}
                            <button type="button" onClick={() => removeDocumentTag(i)} className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 transition-colors">
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Password protection (PRO) */}
                  <div className="space-y-2 rounded-xl border border-border/60 p-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="password-protect"
                        checked={passwordProtect}
                        onCheckedChange={(checked) => {
                          if (!isPro) { setUpgradeModalOpen(true); return; }
                          setPasswordProtect(!!checked);
                        }}
                      />
                      <Label htmlFor="password-protect" className="text-sm flex items-center gap-1.5 cursor-pointer">
                        <LockIcon className="h-3.5 w-3.5" /> Proteger link com senha
                        {!isPro && <Badge variant="outline" className="text-[10px] border-pro/40 text-pro ml-1"><Crown className="mr-0.5 h-2.5 w-2.5" /> Pro</Badge>}
                      </Label>
                    </div>
                    {passwordProtect && isPro && (
                      <Input
                        type="text"
                        placeholder="Defina uma senha simples..."
                        value={accessPassword}
                        onChange={(e) => setAccessPassword(e.target.value)}
                        className="rounded-xl mt-2"
                      />
                    )}
                  </div>

                  {/* Link expiration (PRO) */}
                  <div className="space-y-2 rounded-xl border border-border/60 p-3">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="link-expiration"
                        checked={linkExpiration}
                        onCheckedChange={(checked) => {
                          if (!isPro) { setUpgradeModalOpen(true); return; }
                          setLinkExpiration(!!checked);
                        }}
                      />
                      <Label htmlFor="link-expiration" className="text-sm flex items-center gap-1.5 cursor-pointer">
                        <Clock className="h-3.5 w-3.5" /> Expirar link após X dias
                        {!isPro && <Badge variant="outline" className="text-[10px] border-pro/40 text-pro ml-1"><Crown className="mr-0.5 h-2.5 w-2.5" /> Pro</Badge>}
                      </Label>
                    </div>
                    {linkExpiration && isPro && (
                      <div className="flex items-center gap-2 mt-2">
                        <Input
                          type="number"
                          min={1}
                          max={365}
                          value={expirationDays}
                          onChange={(e) => setExpirationDays(Number(e.target.value))}
                          className="rounded-xl w-20"
                        />
                        <span className="text-sm text-muted-foreground">dias</span>
                      </div>
                    )}
                  </div>

                  {!isPro && (
                    <p className="text-xs text-muted-foreground bg-accent/50 rounded-xl p-3">
                      📊 Plano Free: {activeRequestCount}/{maxRequests} solicitações ativas
                    </p>
                  )}
                </div>
                <DialogFooter className="mt-4">
                  <Button
                    onClick={() => createRequest.mutate()}
                    disabled={createRequest.isPending || checklistItems.length === 0}
                    className="rounded-xl gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300"
                  >
                    {createRequest.isPending ? "Criando..." : "Criar Solicitação ✨"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </motion.div>

        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="mb-6 rounded-2xl">
            <TabsTrigger value="requests" className="rounded-xl">
              <LinkIcon className="mr-2 h-4 w-4" /> Solicitações
            </TabsTrigger>
            <TabsTrigger value="files" className="rounded-xl">
              <FileText className="mr-2 h-4 w-4" /> Arquivos
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl">
              <Settings className="mr-2 h-4 w-4" /> Configurações
            </TabsTrigger>
          </TabsList>

          {/* ─── Solicitações Tab ─── */}
          <TabsContent value="requests">
            {/* View mode toggle */}
            <div className="flex items-center gap-2 mb-4">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                className="rounded-xl"
                onClick={() => setViewMode("list")}
              >
                <LayoutList className="mr-1.5 h-3.5 w-3.5" /> Lista
              </Button>
              <Button
                variant={viewMode === "kanban" ? "default" : "outline"}
                size="sm"
                className="rounded-xl"
                onClick={() => setViewMode("kanban")}
              >
                <Kanban className="mr-1.5 h-3.5 w-3.5" /> Kanban
              </Button>
            </div>

            {requestsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-2xl" />
                ))}
              </div>
            ) : requests?.length === 0 ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16 text-muted-foreground">
                <FileText className="mx-auto h-12 w-12 mb-4 text-border" />
                <p className="text-lg font-medium">Nenhum documento pendente por aqui! 🎉</p>
                <p className="text-sm mt-1">Que paz, hein? Clique em "Criar Solicitação" para começar.</p>
              </motion.div>
            ) : viewMode === "kanban" ? (
              <KanbanView
                requests={requests ?? []}
                uploads={uploads ?? []}
                isPro={isPro}
                slug={slug ?? ""}
                copiedId={copiedId}
                downloadingZipId={downloadingZipId}
                onCopy={handleCopy}
                onReminder={handleMagicReminder}
                onDownloadZip={handleDownloadZip}
                onUpgradeModal={() => setUpgradeModalOpen(true)}
                formatDate={formatDate}
              />
            ) : (
              <div className="space-y-3">
                {requests?.map((req: any, i: number) => {
                  const completed = req.request_items?.filter((item: any) => item.is_completed).length ?? 0;
                  const total = req.request_items?.length ?? 0;
                  const stageGroups = (req.request_items ?? []).reduce((acc: Record<string, any[]>, item: any) => {
                    if (!acc[item.stage_name]) acc[item.stage_name] = [];
                    acc[item.stage_name].push(item);
                    return acc;
                  }, {});
                  const isExpired = req.expires_at && new Date(req.expires_at) < new Date();

                  return (
                    <motion.div
                      key={req.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className={`rounded-2xl border bg-card p-5 shadow-card hover:shadow-elevated transition-all duration-300 ${isExpired ? "border-destructive/30 opacity-70" : "border-border/60"}`}
                    >
                      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                        <div>
                          <h3 className="font-semibold text-card-foreground flex items-center gap-2">
                            {req.client_name}
                            {req.access_password && <LockIcon className="h-3.5 w-3.5 text-pro" />}
                            {isExpired && <Badge variant="destructive" className="text-[10px]">Expirado</Badge>}
                            {req.expires_at && !isExpired && (
                              <Badge variant="outline" className="text-[10px] border-pro/40 text-pro">
                                <Clock className="mr-0.5 h-2.5 w-2.5" /> {formatDate(req.expires_at)}
                              </Badge>
                            )}
                          </h3>
                          <p className="text-xs text-muted-foreground">{formatDate(req.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                            completed === total && total > 0 ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"
                          }`}>
                            {completed}/{total} enviados
                          </span>
                          <Button variant="outline" size="sm" onClick={() => handleCopy(req.id)} className="rounded-xl transition-all duration-200">
                            {copiedId === req.id ? <><Check className="mr-1 h-3 w-3 text-success" /> Copiado</> : <><Copy className="mr-1 h-3 w-3" /> Copiar link</>}
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-xl transition-all duration-200" onClick={() => handleMagicReminder(req)}>
                            {!isPro && <LockIcon className="mr-1 h-3 w-3" />}
                            <MessageCircle className="mr-1 h-3 w-3" /> Lembrete 🪄
                          </Button>
                          <Button variant="ghost" size="sm" className="rounded-xl text-xs" onClick={() => isPro ? setAuditRequestId(auditRequestId === req.id ? null : req.id) : setUpgradeModalOpen(true)}>
                            {!isPro && <LockIcon className="mr-1 h-3 w-3" />} 📜 Histórico
                          </Button>
                          <Button variant="outline" size="sm" className="rounded-xl transition-all duration-200" disabled={downloadingZipId === req.id} onClick={() => handleDownloadZip(req.id, req.client_name)}>
                            {downloadingZipId === req.id ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Archive className="mr-1 h-3 w-3" />} Baixar ZIP 📦
                          </Button>
                        </div>
                      </div>

                      {/* Stage-grouped items */}
                      {Object.keys(stageGroups).length > 1 ? (
                        <Accordion type="multiple" className="mt-2">
                          {Object.entries(stageGroups).map(([stage, items]: [string, any[]]) => (
                            <AccordionItem key={stage} value={stage} className="border-border/40">
                              <AccordionTrigger className="text-xs font-semibold text-muted-foreground uppercase tracking-wider py-2 hover:no-underline">
                                {stage} ({items.filter((i: any) => i.is_completed).length}/{items.length})
                              </AccordionTrigger>
                              <AccordionContent>
                                <div className="flex flex-wrap gap-1">
                                  {items.map((item: any) => (
                                    <span key={item.id} className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                                      item.is_completed ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                                    }`}>
                                      {item.item_name}
                                    </span>
                                  ))}
                                </div>
                              </AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {req.request_items?.map((item: any) => (
                            <span key={item.id} className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
                              item.is_completed ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                            }`}>
                              {item.item_name}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Audit log timeline */}
                      {isPro && auditRequestId === req.id && company && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          className="mt-4 pt-4 border-t border-border/40"
                        >
                          <h4 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">📜 Histórico de Atividades</h4>
                          <AuditLogTimeline requestId={req.id} companyId={company.id} />
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ─── Arquivos Tab ─── */}
          <TabsContent value="files">
            <div className="mb-4 flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar por nome do arquivo ou cliente..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 rounded-xl" />
              </div>
            </div>

            <div className="mb-4 flex gap-2 flex-wrap">
              {([
                { key: "all", label: "Todos", count: uploads?.length ?? 0 },
                { key: "pending", label: "Pendentes ⏳", count: pendingCount },
                { key: "approved", label: "Aprovados ✅", count: approvedCount },
                { key: "rejected", label: "Rejeitados ❌", count: rejectedCount },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFileFilter(tab.key)}
                  className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                    fileFilter === tab.key
                      ? "gradient-primary text-primary-foreground shadow-hero"
                      : "bg-card border border-border/60 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>

            {uploadsLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-2xl" />
                ))}
              </div>
            ) : filteredUploads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="mx-auto h-10 w-10 mb-3 text-border" />
                <p className="text-sm">Nenhum arquivo encontrado 📭</p>
              </div>
            ) : Object.keys(uploadsByStage).length > 1 ? (
              <Accordion type="multiple" defaultValue={Object.keys(uploadsByStage)} className="space-y-2">
                {Object.entries(uploadsByStage).map(([stage, files]) => (
                  <AccordionItem key={stage} value={stage} className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
                    <AccordionTrigger className="px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:no-underline">
                      {stage} ({files.length})
                    </AccordionTrigger>
                    <AccordionContent className="px-0 pb-0">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Arquivo</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Tamanho</TableHead>
                            <TableHead>Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {files.map((file: any) => (
                            <TableRow key={file.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { setPreviewFile(file); setPreviewOpen(true); }}>
                              <TableCell className="font-medium">{file.file_name}</TableCell>
                              <TableCell>
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  file.status === "approved" ? "bg-success/10 text-success" :
                                  file.status === "rejected" ? "bg-destructive/10 text-destructive" :
                                  "bg-accent text-accent-foreground"
                                }`}>
                                  {file.status === "approved" ? "✅" : file.status === "rejected" ? "❌" : "⏳"}
                                </span>
                              </TableCell>
                              <TableCell className="text-muted-foreground">{formatSize(file.file_size)}</TableCell>
                              <TableCell className="text-muted-foreground">{formatDate(file.created_at)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUploads.map((file: any) => (
                      <TableRow key={file.id} className="cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => { setPreviewFile(file); setPreviewOpen(true); }}>
                        <TableCell className="font-medium">{file.file_name}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            file.status === "approved" ? "bg-success/10 text-success" :
                            file.status === "rejected" ? "bg-destructive/10 text-destructive" :
                            "bg-accent text-accent-foreground"
                          }`}>
                            {file.status === "approved" ? "✅" : file.status === "rejected" ? "❌" : "⏳"}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{formatSize(file.file_size)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(file.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── Settings Tab ─── */}
          <TabsContent value="settings">
            <div className="space-y-6">
              {/* Basic settings */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
                <h3 className="mb-4 text-sm font-semibold text-foreground">Configurações da Conta ⚙️</h3>
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label htmlFor="display-name">Nome de Exibição</Label>
                    <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug da URL</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground whitespace-nowrap">/{""}</span>
                      <Input id="slug" value={slugValue} onChange={(e) => setSlugValue(e.target.value)} className="rounded-xl" />
                      <span className="text-sm text-muted-foreground">/enviar</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* PRO: Branding */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Branding Avançado 🎨</h3>
                  {!isPro && <Badge variant="outline" className="text-xs border-pro/40 text-pro"><Crown className="mr-1 h-3 w-3" /> Pro</Badge>}
                </div>
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label>Logo URL</Label>
                    <Input placeholder="https://minha-empresa.com/logo.png" value={logoUrl} onChange={(e) => isPro ? setLogoUrl(e.target.value) : setUpgradeModalOpen(true)} className="rounded-xl" disabled={!isPro} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> CNPJ</Label>
                    <Input placeholder="00.000.000/0001-00" value={cnpj} onChange={(e) => isPro ? setCnpj(e.target.value) : setUpgradeModalOpen(true)} className="rounded-xl" disabled={!isPro} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Telefone de Contato</Label>
                    <Input placeholder="(14) 99999-9999" value={phone} onChange={(e) => isPro ? setPhone(e.target.value) : setUpgradeModalOpen(true)} className="rounded-xl" disabled={!isPro} />
                  </div>
                  <div className="space-y-2">
                    <Label>Cor da Marca</Label>
                    <div className="flex items-center gap-4">
                      <input type="color" value={brandColor} onChange={(e) => isPro ? setBrandColor(e.target.value) : setUpgradeModalOpen(true)} className="h-10 w-10 rounded-xl border border-border cursor-pointer" disabled={!isPro} />
                      <Input value={brandColor} onChange={(e) => isPro ? setBrandColor(e.target.value) : undefined} className="rounded-xl max-w-[120px] font-mono text-sm" disabled={!isPro} readOnly={!isPro} />
                      <div className="h-10 w-10 rounded-xl border border-border" style={{ backgroundColor: brandColor }} />
                      {!isPro && (
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setUpgradeModalOpen(true)}>
                          <LockIcon className="mr-1.5 h-3 w-3" /> Desbloquear
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* PRO: OwnCloud Sync */}
              <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <Cloud className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Sincronização em Nuvem (ownCloud) ☁️</h3>
                  {!isPro && <Badge variant="outline" className="text-xs border-pro/40 text-pro"><Crown className="mr-1 h-3 w-3" /> Pro</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Configure seu servidor ownCloud para sincronizar automaticamente arquivos aprovados via WebDAV.
                </p>
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label>URL do Servidor ownCloud</Label>
                    <Input placeholder="https://cloud.seudominio.com.br" value={owncloudUrl} onChange={(e) => isPro ? setOwncloudUrl(e.target.value) : setUpgradeModalOpen(true)} className="rounded-xl" disabled={!isPro} />
                  </div>
                  <div className="space-y-2">
                    <Label>Usuário</Label>
                    <Input placeholder="admin" value={owncloudUser} onChange={(e) => isPro ? setOwncloudUser(e.target.value) : setUpgradeModalOpen(true)} className="rounded-xl" disabled={!isPro} />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha / Token de Aplicativo</Label>
                    <Input type="password" placeholder="Token de aplicativo..." value={owncloudToken} onChange={(e) => isPro ? setOwncloudToken(e.target.value) : setUpgradeModalOpen(true)} className="rounded-xl" disabled={!isPro} />
                  </div>
                  {isPro && owncloudUrl && (
                    <p className="text-xs text-success flex items-center gap-1">
                      <Check className="h-3 w-3" /> Configurado — arquivos aprovados serão sincronizados automaticamente
                    </p>
                  )}
                </div>
              </div>

              {/* Save button */}
              <Button onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending} className="rounded-xl gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300">
                {updateSettings.isPending ? "Salvando..." : "Salvar alterações ✅"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* File Preview Modal */}
      <FilePreviewModal
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        file={previewFile}
        onStatusChange={() => {
          console.log("[dashboard] onStatusChange → invalidating uploads + requests");
          queryClient.invalidateQueries({ queryKey: ["uploads", company?.id] });
          queryClient.invalidateQueries({ queryKey: ["requests", company?.id] });
        }}
      />

      {/* Pro Upgrade Modal */}
      <Dialog open={upgradeModalOpen} onOpenChange={setUpgradeModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-16 w-16 rounded-3xl gradient-primary flex items-center justify-center shadow-hero">
              <Crown className="h-8 w-8 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Desbloqueie o Pro ✨</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Solicitações ilimitadas, uploads de até 2GB, white-label, lembrete mágico, senha no link, expiração, ownCloud sync, logs de auditoria e muito mais.
            </p>
            <div className="mt-2">
              <span className="text-3xl font-extrabold text-foreground">R$49</span>
              <span className="text-muted-foreground">/mês</span>
            </div>
            <a href="https://wa.me/5514991712801?text=Ol%C3%A1!%20Quero%20assinar%20o%20plano%20PRO%20do%20Portal%20Segur%C3%ADssimo!" target="_blank" rel="noopener noreferrer" className="w-full">
              <Button className="w-full rounded-2xl h-11 gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300">
                Fazer Upgrade Agora 🚀
              </Button>
            </a>
            <button onClick={() => setUpgradeModalOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Agora não
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Cloud Sync Modal - now shows OwnCloud info */}
      <Dialog open={cloudSyncModalOpen} onOpenChange={setCloudSyncModalOpen}>
        <DialogContent className="max-w-sm rounded-3xl text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="h-16 w-16 rounded-3xl bg-accent flex items-center justify-center">
              <Cloud className="h-8 w-8 text-accent-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground">ownCloud Sync ☁️</h2>
            {owncloudUrl ? (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Configurado! Arquivos aprovados são sincronizados automaticamente para <strong className="text-foreground">{owncloudUrl}</strong>
                </p>
                <Badge variant="outline" className="text-xs border-success/40 text-success">
                  <Check className="mr-1 h-3 w-3" /> Ativo
                </Badge>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Configure seu servidor ownCloud na aba Configurações para ativar a sincronização automática via WebDAV.
                </p>
                <Button variant="outline" className="rounded-xl" onClick={() => { setCloudSyncModalOpen(false); }}>
                  Ir para Configurações
                </Button>
              </>
            )}
            <button onClick={() => setCloudSyncModalOpen(false)} className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-2">
              Fechar
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
