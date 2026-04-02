import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Shield, Copy, Check, Download, FileText, Settings, LogOut,
  Link as LinkIcon, Plus, Trash2, Tag, Sparkles, Crown, Lock as LockIcon,
  Search, Cloud, Palette, Filter, MessageCircle, Phone, Building2,
  Archive, Loader2, LayoutList, Kanban, Clock, Type, Upload, AlertTriangle, BookTemplate
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";
import FilePreviewModal from "@/components/dashboard/FilePreviewModal";
import ErrorBoundary from "@/components/ErrorBoundary";
import KanbanView from "@/components/dashboard/KanbanView";
import TemplatesTab from "@/components/dashboard/TemplatesTab";
import { ThemeToggle } from "@/components/ThemeToggle";

const COMMON_DOCUMENTS = [
  { label: "RG / CNH", stage: "Documentos Pessoais" },
  { label: "CPF", stage: "Documentos Pessoais" },
  { label: "Comprovante de Residência", stage: "Documentos Pessoais" },
  { label: "Contrato Social", stage: "Documentos Empresariais" },
  { label: "Cartão CNPJ", stage: "Documentos Empresariais" },
  { label: "Extrato Bancário", stage: "Documentos Financeiros" },
  { label: "Holerite / Contracheque", stage: "Documentos Financeiros" },
  { label: "Declaração de IR", stage: "Documentos Financeiros" },
];

const TEMPLATES = [
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
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // --- UI States ---
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [showArchived, setShowArchived] = useState(false);
  const [manageRequestOpen, setManageRequestOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<{id: string, clientName: string} | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fileFilter, setFileFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [downloadingZipId, setDownloadingZipId] = useState<string | null>(null);

  // --- Form States ---
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [customItemStage, setCustomItemStage] = useState("");
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
  const [logoUploading, setLogoUploading] = useState(false);

  // OwnCloud config
  const [owncloudUrl, setOwncloudUrl] = useState("");
  const [owncloudUser, setOwncloudUser] = useState("");
  const [owncloudToken, setOwncloudToken] = useState("");

  // Google Drive config
  const [gdriveClientId, setGdriveClientId] = useState("");
  const [gdriveClientSecret, setGdriveClientSecret] = useState("");

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
      const { data, error } = await supabase.from("companies").select("*").eq("slug", slug).single();
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
      setGdriveClientId((company as any).gdrive_client_id ?? "");
      setGdriveClientSecret((company as any).gdrive_client_secret ?? "");
    }
  }, [company]);

  // Fetch plan
  const { data: plan } = useQuery({
    queryKey: ["plan", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_plans").select("*").eq("company_id", company!.id).single();
      return data;
    },
    enabled: !!company?.id,
  });

  const isPro = plan?.plan === "pro";
  const owncloudUrl = (company as any)?.owncloud_url || "";

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ["requests", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requests")
        .select("*, request_items(id, item_name, stage_name, is_completed, sort_order)")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!company?.id,
  });

  const { data: uploads, isLoading: uploadsLoading } = useQuery({
    queryKey: ["uploads", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uploads")
        .select("*, request_items!inner(item_name, stage_name, request_id, document_requests:request_id(client_name))")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!company?.id,
  });

  const { data: customTemplates } = useQuery({
    queryKey: ["my-custom-templates", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("templates").select("*, template_items(*)").eq("company_id", company!.id);
      return data;
    },
    enabled: !!company?.id && isPro,
  });

  // --- Logic & Helpers ---
  const normalize = (str: string) => str?.toLowerCase().replace(/[^a-z0-9]/gi, '') || '';

  const filteredUploads = useMemo(() => {
    return (uploads || []).filter((file: any) => {
      const matchesFilter = fileFilter === "all" || file.status === fileFilter;
      const q = searchQuery.toLowerCase();
      return matchesFilter && (!q || file.file_name?.toLowerCase().includes(q) || file.request_items?.document_requests?.client_name?.toLowerCase().includes(q));
    });
  }, [uploads, fileFilter, searchQuery]);

  const allAvailableItems = useMemo(() => {
    const itemsMap = new Map();
    const addItem = (stage: string, name: string, type: string) => {
      const key = normalize(name);
      if (!itemsMap.has(key)) itemsMap.set(key, { stageName: stage, itemName: name.trim(), itemType: type });
    };
    COMMON_DOCUMENTS.forEach(doc => addItem(doc.stage, doc.label, "file"));
    TEMPLATES.forEach(tpl => tpl.items.forEach(item => addItem(item.stage, item.label, "file")));
    customTemplates?.forEach((tpl: any) => tpl.template_items?.forEach((ti: any) => addItem(ti.stage_name, ti.item_name, ti.item_type || "file")));
    return Array.from(itemsMap.values()).sort((a: any, b: any) => a.itemName.localeCompare(b.itemName));
  }, [customTemplates]);

  // --- Handlers ---
  const addDocumentTag = (label: string, stage: string, type: "file" | "text" = "file") => {
    if (checklistItems.some(i => normalize(i.itemName) === normalize(label))) {
      toast.warning("Item já está na lista");
      return;
    }
    setChecklistItems([...checklistItems, { stageName: stage || "Geral", itemName: label.trim(), itemType: type }]);
  };

  // RESTAURANDO A FUNÇÃO QUE FALTAVA 🛠️
  const addCustomItem = () => {
    if (!customItemName.trim()) return;
    addDocumentTag(customItemName, customItemStage || "Geral", customItemType);
    setCustomItemName("");
  };

  const applyTemplate = (tpl: any) => {
    const merged = [...checklistItems];
    tpl.items.forEach((t: any) => {
      if (!merged.some(m => normalize(m.itemName) === normalize(t.label || t.item_name))) {
        merged.push({ stageName: t.stage || t.stage_name, itemName: (t.label || t.item_name).trim(), itemType: t.item_type || "file" });
      }
    });
    setChecklistItems(merged);
    toast.success("Template aplicado!");
  };

  const handleDownloadZip = useCallback(async (requestId: string, name: string) => {
    setDownloadingZipId(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/download-zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ requestId }),
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${name}.zip`; a.click();
      toast.success("Download iniciado! 📦");
    } catch (err: any) { toast.error("Erro ao gerar ZIP"); } finally { setDownloadingZipId(null); }
  }, []);

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!company || !clientName.trim() || checklistItems.length === 0) throw new Error("Incompleto");
      const { data: req, error: reqErr } = await supabase.from("document_requests").insert({
        company_id: company.id, client_name: clientName, client_email: clientEmail || null,
        access_password: isPro && passwordProtect ? accessPassword : null,
        expires_at: isPro && linkExpiration ? new Date(Date.now() + expirationDays * 86400000).toISOString() : null
      }).select().single();
      if (reqErr) throw reqErr;
      const items = checklistItems.map((it, i) => ({ request_id: req.id, stage_name: it.stageName, item_name: it.itemName, sort_order: i, item_type: it.itemType }));
      await supabase.from("request_items").insert(items);
      return req;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["requests"] });
      setDialogOpen(false);
      setClientName(""); setChecklistItems([]);
      toast.success("Solicitação criada! 🚀");
    }
  });

  const archiveRequest = useMutation({
    mutationFn: async (id: string) => await supabase.from("document_requests").update({ status: "archived" }).eq("id", id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["requests"] }); setManageRequestOpen(false); toast.success("Engavetado!"); }
  });

  const deleteRequest = useMutation({
    mutationFn: async (id: string) => await supabase.from("document_requests").delete().eq("id", id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["requests"] }); setManageRequestOpen(false); toast.success("Excluído!"); }
  });

  // Update settings
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
      if (isPro) {
        updateData.owncloud_url = owncloudUrl || null;
        updateData.owncloud_user = owncloudUser || null;
        updateData.owncloud_token = owncloudToken || null;
        updateData.gdrive_client_id = gdriveClientId || null;
        updateData.gdrive_client_secret = gdriveClientSecret || null;
      }
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

  const handleMagicReminder = (req: any) => {
    if (!isPro) {
      setUpgradeModalOpen(true);
      return;
    }

    const allItems = (req.request_items ?? []) as any[];
    const requestUploads = (uploads ?? []).filter((u: any) =>
      allItems.some((item: any) => item.id === u.request_item_id)
    );

    const pendingItems = allItems.filter((item: any) => {
      if (item.item_type === "text" && item.is_completed) return false;
      const itemUploads = requestUploads.filter((u: any) => u.request_item_id === item.id);
      if (itemUploads.length === 0 && item.item_type !== "text") return true;
      if (item.item_type === "text" && !item.is_completed) return true;
      
      const latestUpload = itemUploads.sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0];
      return latestUpload?.status === "rejected";
    });

    if (pendingItems.length === 0) {
      toast.info("Todos os documentos já foram enviados! 🎉");
      return;
    }

    const rejectedItems = pendingItems.filter((item: any) => {
      const latestUpload = requestUploads
        .filter((u: any) => u.request_item_id === item.id)
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return latestUpload?.status === "rejected";
    });

    const notSentItems = pendingItems.filter((item: any) => !rejectedItems.includes(item));

    let docList = "";
    if (notSentItems.length > 0) {
      docList += notSentItems.map((item: any) => `📎 ${item.item_name}`).join("\n");
    }
    if (rejectedItems.length > 0) {
      if (docList) docList += "\n\n";
      docList += "⚠️ *Documentos que precisam ser reenviados:*\n";
      docList += rejectedItems.map((item: any) => {
        const latestUpload = requestUploads
          .filter((u: any) => u.request_item_id === item.id)
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        const reason = latestUpload?.rejection_reason ? ` (Motivo: ${latestUpload.rejection_reason})` : "";
        return `🔄 ${item.item_name}${reason}`;
      }).join("\n");
    }

    const link = `${window.location.origin}/${slug}/enviar/${req.id}`;
    const message = `Olá, ${req.client_name}! 👋\n\nPassando para lembrar que ainda aguardamos o envio dos seguintes documentos:\n\n${docList}\n\n📲 Acesse seu link seguro para enviar:\n${link}\n\nQualquer dúvida, estou à disposição!`;
    const encoded = encodeURIComponent(message);

    const rawContact = (req.client_email ?? "").trim();
    const digitsOnly = rawContact.replace(/\D/g, "");
    const isPhone = digitsOnly.length >= 10 && !rawContact.includes("@");
    const waUrl = isPhone
      ? `https://wa.me/${digitsOnly}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(waUrl, "_blank");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const handleCheckout = async () => {
    setCheckoutLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-infinitepay-checkout");
      if (error || data?.error) {
        if (data?.fallback_url) {
          window.open(data.fallback_url, "_blank");
        } else {
          toast.error("Erro ao gerar checkout", { description: data?.error || error?.message });
        }
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      toast.error("Erro ao processar pagamento");
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleDownloadZip = useCallback(async (requestId: string, clientNameArg: string) => {
    setDownloadingZipId(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      toast.info("Gerando ZIP... aguarde ⏳");
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const functionUrl = `https://${projectId}.supabase.co/functions/v1/download-zip`;

      const response = await fetch(functionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
          "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ requestId }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMsg = "Erro ao gerar ZIP";
        try {
          const parsed = JSON.parse(errorBody);
          errorMsg = parsed.error || errorMsg;
        } catch { /* not JSON */ }
        toast.error(errorMsg);
        return;
      }

      const blob = await response.blob();
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

  const uploadsByClient = filteredUploads.reduce<Record<string, any[]>>((acc, file: any) => {
    const clientName = file.request_items?.document_requests?.client_name ?? "Sem cliente";
    if (!acc[clientName]) acc[clientName] = [];
    acc[clientName].push(file);
    return acc;
  }, {});

  const visibleRequests = requests?.filter((r: any) => showArchived ? r.status === "archived" : r.status !== "archived") ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="glass sticky top-0 z-50 border-b border-border/40">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary shadow-sm">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold">Seguríssimo</span>
            {isPro && <Badge variant="outline" className="text-[10px] border-pro/40 text-pro ml-1"><Crown className="mr-1 h-3 w-3" /> Pro</Badge>}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}><LogOut className="mr-2 h-4 w-4" /> Sair</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas solicitações e arquivos</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="rounded-xl transition-all duration-200" onClick={() => navigate(`/${slug}/templates`)}>
              <LayoutList className="mr-1.5 h-4 w-4" /> Templates
            </Button>
            
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300">
                  <Plus className="mr-2 h-4 w-4" /> Criar Solicitação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl rounded-3xl overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Nova Solicitação 📄</DialogTitle>
                  <DialogDescription>Crie um link seguro para seu cliente enviar documentos.</DialogDescription>
                </DialogHeader>
                <div className="space-y-5 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Nome do Cliente</Label>
                      <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="João Silva" className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">E-mail / WhatsApp</Label>
                      <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="cliente@email.com" className="rounded-xl" />
                    </div>
                  </div>
                  
                  <div className="space-y-2 bg-accent/30 p-4 rounded-2xl border border-border/40">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold">
                      <Tag className="h-3 w-3 text-primary" /> Aplicar Templates
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {TEMPLATES.map(tpl => (
                        <Button key={tpl.name} variant="outline" size="sm" onClick={() => applyTemplate(tpl)} className="rounded-xl bg-background hover:bg-accent">
                          {tpl.emoji} {tpl.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <Label className="text-sm font-bold">Adicionar Itens</Label>
                    <Select onValueChange={val => { const s = allAvailableItems.find(i => i.itemName === val); if (s) addDocumentTag(s.itemName, s.stageName, s.itemType); }}>
                      <SelectTrigger className="rounded-xl bg-accent/20 shadow-sm"><SelectValue placeholder="Puxar de templates..." /></SelectTrigger>
                      <SelectContent className="rounded-2xl">
                        {allAvailableItems.map((it, idx) => (
                          <SelectItem key={idx} value={it.itemName}>{it.itemType === "text" ? "📝" : "📎"} {it.itemName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <div className="grid grid-cols-[100px_1fr_auto] gap-2">
                      <Input placeholder="Estágio" value={customItemStage} onChange={e => setCustomItemStage(e.target.value)} className="rounded-xl text-xs" />
                      <Input placeholder="Nome do item..." value={customItemName} onChange={e => setCustomItemName(e.target.value)} className="rounded-xl text-xs" />
                      <Button variant="outline" size="icon" onClick={addCustomItem} className="rounded-xl shrink-0"><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  {checklistItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-accent/20 rounded-2xl border border-dashed border-border/60">
                      {checklistItems.map((it, i) => (
                        <Badge key={i} variant="secondary" className="rounded-full pr-1.5 py-1 text-[11px] bg-background border shadow-sm">
                          {it.itemName}
                          <button onClick={() => setChecklistItems(checklistItems.filter((_, idx) => idx !== i))} className="ml-1.5 hover:text-destructive"><Trash2 className="h-3 w-3" /></button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <DialogFooter className="mt-6 border-t pt-4">
                  <Button onClick={() => createRequest.mutate()} className="w-full rounded-xl gradient-primary h-11 text-base shadow-hero" disabled={createRequest.isPending}>
                    {createRequest.isPending ? <Loader2 className="animate-spin" /> : "Gerar Link de Upload ✨"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats 📊 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Solicitações", value: requests?.length ?? 0, icon: LinkIcon, color: "text-primary", bg: "bg-primary/10" },
            { label: "Pendentes", value: uploads?.filter((f: any) => f.status === "pending").length ?? 0, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "Aprovados", value: uploads?.filter((f: any) => f.status === "approved").length ?? 0, icon: Check, color: "text-success", bg: "bg-success/10" },
            { label: "Taxa", value: `${uploads?.length ? Math.round((uploads.filter((f:any)=>f.status==='approved').length/uploads.length)*100) : 0}%`, icon: Sparkles, color: "text-pro", bg: "bg-pro/10" },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 shadow-card hover:shadow-elevated transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}><stat.icon className={`h-5 w-5 ${stat.color}`} /></div>
                <div><p className="text-2xl font-bold">{stat.value}</p><p className="text-[10px] text-muted-foreground uppercase">{stat.label}</p></div>
              </div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="mb-6 rounded-2xl">
            <TabsTrigger value="requests" className="rounded-xl">
              <LinkIcon className="mr-2 h-4 w-4" /> Solicitações
            </TabsTrigger>
            <TabsTrigger value="files" className="rounded-xl">
              <FileText className="mr-2 h-4 w-4" /> Arquivos
            </TabsTrigger>
            <TabsTrigger value="templates" className="rounded-xl">
              <BookTemplate className="mr-2 h-4 w-4" /> Templates
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl">
              <Settings className="mr-2 h-4 w-4" /> Configurações
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="requests" className="space-y-4">
             <div className="flex gap-2 mb-4 items-center">
                <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")} className="rounded-xl">Lista</Button>
                <Button variant={viewMode === "kanban" ? "default" : "outline"} size="sm" onClick={() => setViewMode("kanban")} className="rounded-xl">Kanban</Button>
                <Button variant="ghost" size="sm" onClick={() => setShowArchived(!showArchived)} className="ml-auto rounded-xl text-xs gap-1.5"><Archive className="h-3.5 w-3.5" /> {showArchived ? "Ativas" : "Engavetadas"}</Button>
             </div>
             
             {requestsLoading ? <Skeleton className="h-32 w-full rounded-2xl" /> : visibleRequests.map((req: any) => (
                <motion.div key={req.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-elevated transition-all mb-3">
                   <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                      <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">{req.client_name} {req.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-success" />}</h3>
                        <p className="text-xs text-muted-foreground">Criado em {new Date(req.created_at).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${slug}/enviar/${req.id}`); toast.success("Copiado!"); }} className="rounded-xl shadow-sm"><Copy className="h-3.5 w-3.5 mr-1.5" /> Link</Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadZip(req.id, req.client_name)} className="rounded-xl shadow-sm" disabled={downloadingZipId === req.id}>
                          {downloadingZipId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5 mr-1.5" />} ZIP
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedRequest({ id: req.id, clientName: req.client_name }); setManageRequestOpen(true); }} className="rounded-xl text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                      </div>
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {req.request_items?.map((it: any) => <Badge key={it.id} variant="outline" className={`rounded-full text-[10px] px-2.5 py-0.5 ${it.is_completed ? 'bg-success/10 text-success border-success/30' : 'bg-muted/50 text-muted-foreground'}`}>{it.item_name}</Badge>)}
                   </div>
                </motion.div>
             ))}
          </TabsContent>

          <TabsContent value="files">
             <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar arquivos..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 rounded-xl bg-card border-border/60" />
             </div>
             <div className="rounded-2xl border border-border/40 overflow-hidden shadow-sm bg-card">
                <Table>
                  <TableHeader className="bg-muted/30"><TableRow><TableHead>Arquivo</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Data</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {(filteredUploads || []).map((file: any) => (
                      <TableRow key={file.id} className="cursor-pointer hover:bg-accent/40" onClick={() => { setPreviewFile(file); setPreviewOpen(true); }}>
                        <TableCell className="font-semibold text-sm">{file.file_name}</TableCell>
                        <TableCell><Badge variant="outline" className={`text-[10px] px-2 rounded-full font-bold ${file.status === 'approved' ? 'text-success border-success/30 bg-success/5' : file.status === 'rejected' ? 'text-destructive border-destructive/30 bg-destructive/5' : 'text-amber-600'}`}>{file.status?.toUpperCase()}</Badge></TableCell>
                        <TableCell className="text-right text-[11px] text-muted-foreground">{new Date(file.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </TabsContent>

          {/* ─── Templates Tab ─── */}
          <TabsContent value="templates">
            {isPro ? (
              <TemplatesTab companyId={company?.id} />
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-20">
                <div className="mx-auto max-w-sm rounded-3xl border-2 border-primary/20 glass p-10 shadow-glow">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl gradient-primary shadow-hero">
                    <Crown className="h-10 w-10 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-2">Templates Personalizados ✨</h3>
                  <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    Crie kits de documentos reutilizáveis para agilizar seu fluxo de trabalho. Disponível exclusivamente no plano Pro.
                  </p>
                  <Button
                    className="w-full rounded-2xl h-11 gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300"
                    onClick={() => handleCheckout()}
                    disabled={checkoutLoading}
                  >
                    {checkoutLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando checkout...</> : <>Fazer Upgrade para Pro 🚀</>}
                  </Button>
                </div>
              </motion.div>
            )}
          </TabsContent>

          {/* ─── Settings Tab ─── */}
          <TabsContent value="settings">
            <div className="space-y-6">
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

              <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <Palette className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Branding Avançado 🎨</h3>
                  {!isPro && <Badge variant="outline" className="text-xs border-pro/40 text-pro"><Crown className="mr-1 h-3 w-3" /> Pro</Badge>}
                </div>
                <div className="space-y-4 max-w-md">
                  <div className="space-y-2">
                    <Label>Logo da Empresa</Label>
                    <div className="flex items-center gap-4">
                      {logoUrl && (
                        <img src={logoUrl} alt="Logo" className="h-12 w-12 rounded-2xl object-cover border border-border shadow-card" />
                      )}
                      <label className={`cursor-pointer inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-accent ${!isPro ? 'opacity-50 pointer-events-none' : ''}`}>
                        {logoUploading ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                        ) : (
                          <><Upload className="h-4 w-4" /> {logoUrl ? "Trocar logo" : "Enviar logo"}</>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={!isPro || logoUploading}
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file || !company) return;
                            if (!isPro) { setUpgradeModalOpen(true); return; }
                            setLogoUploading(true);
                            try {
                              const ext = file.name.split('.').pop();
                              const filePath = `${company.id}/logo.${ext}`;
                              const { error: uploadError } = await supabase.storage
                                .from("logos")
                                .upload(filePath, file, { upsert: true });
                              if (uploadError) throw uploadError;
                              const { data: urlData } = supabase.storage.from("logos").getPublicUrl(filePath);
                              const publicUrl = urlData.publicUrl + "?t=" + Date.now();
                              setLogoUrl(publicUrl);
                              toast.success("Logo enviada! Salve as configurações para aplicar ✅");
                            } catch (err: any) {
                              console.error("[logo-upload]", err);
                              toast.error("Erro ao enviar logo", { description: err.message });
                            } finally {
                              setLogoUploading(false);
                              e.target.value = "";
                            }
                          }}
                        />
                      </label>
                      {logoUrl && isPro && (
                        <Button variant="ghost" size="sm" className="text-destructive rounded-xl" onClick={() => setLogoUrl("")}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
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

              <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-card">
                <div className="flex items-center gap-2 mb-4">
                  <Cloud className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">Sincronização em Nuvem ☁️</h3>
                  {!isPro && <Badge variant="outline" className="text-xs border-pro/40 text-pro"><Crown className="mr-1 h-3 w-3" /> Pro</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Configure seu servidor de nuvem para sincronizar automaticamente arquivos aprovados.
                </p>

                {/* ownCloud Section */}
                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">ownCloud (WebDAV)</h4>
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

                {/* Google Drive Section */}
                <div className="border-t border-border/40 pt-6">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Google Drive</h4>
                  <div className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <Label>Client ID (OAuth)</Label>
                      <Input placeholder="xxxx.apps.googleusercontent.com" value={gdriveClientId} onChange={(e) => isPro ? setGdriveClientId(e.target.value) : setUpgradeModalOpen(true)} className="rounded-xl" disabled={!isPro} />
                    </div>
                    <div className="space-y-2">
                      <Label>Client Secret</Label>
                      <Input type="password" placeholder="GOCSPX-..." value={gdriveClientSecret} onChange={(e) => isPro ? setGdriveClientSecret(e.target.value) : setUpgradeModalOpen(true)} className="rounded-xl" disabled={!isPro} />
                    </div>
                    <Button
                      variant="outline"
                      className="rounded-xl"
                      disabled={!isPro || !gdriveClientId || !gdriveClientSecret}
                      onClick={() => toast.info("Autorização Google Drive em breve!", { description: "Esta funcionalidade será ativada na próxima atualização." })}
                    >
                      🔗 Autorizar Google Drive
                    </Button>
                    {isPro && gdriveClientId && gdriveClientSecret && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        Credenciais salvas. Clique em "Autorizar" para concluir a integração.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <Button onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending} className="rounded-xl gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300">
                {updateSettings.isPending ? "Salvando..." : "Salvar alterações ✅"}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      <ErrorBoundary fallbackMessage="Erro no preview">
        <FilePreviewModal
          open={previewOpen} onOpenChange={setPreviewOpen} file={previewFile} owncloudUrl={owncloudUrl} 
          onStatusChange={() => { queryClient.invalidateQueries({ queryKey: ["uploads"] }); queryClient.invalidateQueries({ queryKey: ["requests"] }); }}
        />
      </ErrorBoundary>

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
            <Button
              className="w-full rounded-2xl h-11 gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300"
              onClick={() => handleCheckout()}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gerando checkout...</> : "Fazer Upgrade Agora 🚀"}
            </Button>
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
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
