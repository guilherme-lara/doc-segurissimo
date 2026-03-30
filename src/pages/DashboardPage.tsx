import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Shield, Copy, Check, Download, FileText, Settings, LogOut,
  Link as LinkIcon, Plus, Trash2, Tag, Sparkles, Crown, Lock as LockIcon,
  Search, Cloud, Palette, Filter, MessageCircle, Phone, Building2,
  Archive, Loader2, LayoutList, Kanban, Clock, Type, Upload, AlertTriangle, CheckCircle2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import ErrorBoundary from "@/components/ErrorBoundary";
import AuditLogTimeline from "@/components/dashboard/AuditLogTimeline";
import KanbanView from "@/components/dashboard/KanbanView";
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
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [showArchived, setShowArchived] = useState(false);
  const [manageRequestOpen, setManageRequestOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<{id: string, clientName: string} | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);
  const [cloudSyncModalOpen, setCloudSyncModalOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<any>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [fileFilter, setFileFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [auditRequestId, setAuditRequestId] = useState<string | null>(null);

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

  const [brandColor, setBrandColor] = useState("#7c3aed");
  const [logoUrl, setLogoUrl] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [slugValue, setSlugValue] = useState("");
  const [owncloudUrl, setOwncloudUrl] = useState("");
  const [owncloudUser, setOwncloudUser] = useState("");
  const [owncloudToken, setOwncloudToken] = useState("");

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["company", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").eq("slug", slug).single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: plan } = useQuery({
    queryKey: ["plan", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_plans").select("*").eq("company_id", company!.id).single();
      return data;
    },
    enabled: !!company?.id,
  });

  const isPro = plan?.plan === "pro";

  useEffect(() => {
    if (company) {
      setBrandColor(company.primary_color ?? "#7c3aed");
      setLogoUrl(company.logo_url ?? "");
      setCnpj((company as any).cnpj ?? "");
      setPhone((company as any).phone ?? "");
      setOwncloudUrl((company as any).owncloud_url ?? "");
      setOwncloudUser((company as any).owncloud_user ?? "");
      setOwncloudToken((company as any).owncloud_token ?? "");
      setDisplayName(company.display_name);
      setSlugValue(company.slug);
    }
  }, [company]);

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

  const filteredUploads = useMemo(() => {
    return uploads?.filter((file: any) => {
      const matchesFilter = fileFilter === "all" || file.status === fileFilter;
      const query = searchQuery.toLowerCase();
      const matchesSearch = !query ||
        file.file_name?.toLowerCase().includes(query) ||
        file.request_items?.document_requests?.client_name?.toLowerCase().includes(query) ||
        file.request_items?.item_name?.toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    }) ?? [];
  }, [uploads, fileFilter, searchQuery]);

  const pendingCount = uploads?.filter((f: any) => f.status === "pending").length ?? 0;
  const approvedCount = uploads?.filter((f: any) => f.status === "approved").length ?? 0;
  const rejectedCount = uploads?.filter((f: any) => f.status === "rejected").length ?? 0;

  const normalize = (str: string) => str?.toLowerCase().replace(/[^a-z0-9]/gi, '') || '';
  
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

  useEffect(() => {
    if (!company?.id) return;
    const channel = supabase.channel(`dashboard-realtime-${company.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "uploads", filter: `company_id=eq.${company.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["uploads", company.id] });
        queryClient.invalidateQueries({ queryKey: ["requests", company.id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "request_items" }, () => {
        queryClient.invalidateQueries({ queryKey: ["requests", company.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [company?.id, queryClient]);

  const addDocumentTag = (label: string, stage: string, type: "file" | "text" = "file") => {
    if (checklistItems.some(i => normalize(i.itemName) === normalize(label))) {
      toast.warning("Este item já está na lista!");
      return;
    }
    setChecklistItems([...checklistItems, { stageName: stage, itemName: label.trim(), itemType: type }]);
  };

  const addCustomItem = () => {
    if (!customItemName.trim()) return;
    addDocumentTag(customItemName, customItemStage || "Geral", customItemType);
    setCustomItemName("");
  };

  const applyTemplate = (template: any) => {
    const merged = [...checklistItems];
    template.items.forEach((t: any) => {
      const key = normalize(t.label || t.item_name);
      if (!merged.some(m => normalize(m.itemName) === key)) {
        merged.push({ stageName: t.stage || t.stage_name, itemName: (t.label || t.item_name).trim(), itemType: t.item_type || "file" });
      }
    });
    setChecklistItems(merged);
    toast.success("Template aplicado!");
  };

  const createRequest = useMutation({
    mutationFn: async () => {
      if (!company || !clientName.trim() || checklistItems.length === 0) throw new Error("Preencha o nome e adicione itens.");
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
      setClientName("");
      setChecklistItems([]);
      toast.success("Solicitação criada! 🚀");
    }
  });

  const handleDownloadZip = useCallback(async (requestId: string, name: string) => {
    setDownloadingZipId(requestId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/download-zip`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token}`, "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) throw new Error("Erro ao gerar ZIP");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${name}.zip`; a.click();
      toast.success("Download concluído! 📦");
    } catch (err: any) { toast.error(err.message); } finally { setDownloadingZipId(null); }
  }, []);

  const visibleRequests = requests?.filter((r: any) => showArchived ? r.status === "archived" : r.status !== "archived") ?? [];

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER RESTAURADO 💎 */}
      <header className="glass sticky top-0 z-50 border-b border-border/40">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl gradient-primary shadow-sm">
              <Shield className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground">Seguríssimo</span>
            {isPro && (
              <Badge variant="outline" className="text-[10px] border-pro/40 text-pro ml-1">
                <Crown className="mr-1 h-3 w-3" /> Pro
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => supabase.auth.signOut().then(() => navigate("/"))}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* ACTIONS HEADER BAR */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas solicitações e arquivos</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" className="rounded-xl transition-all duration-200" onClick={() => navigate(`/${slug}/templates`)}>
              <LayoutList className="mr-1.5 h-4 w-4" /> Templates
            </Button>
            
            {isPro && owncloudUrl && (
              <Button variant="outline" size="sm" className="rounded-xl transition-all duration-200" onClick={() => setCloudSyncModalOpen(true)}>
                <Cloud className="mr-1.5 h-3 w-3" /> ownCloud
              </Button>
            )}

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="rounded-xl gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300">
                  <Plus className="mr-2 h-4 w-4" /> Criar Solicitação
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl rounded-3xl overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle>Nova Solicitação 📄</DialogTitle>
                </DialogHeader>
                <div className="space-y-5 mt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nome do Cliente</Label>
                      <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ex: João Silva" className="rounded-xl" />
                    </div>
                    <div className="space-y-2">
                      <Label>E-mail / WhatsApp</Label>
                      <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="cliente@email.com" className="rounded-xl" />
                    </div>
                  </div>
                  
                  <div className="space-y-2 bg-accent/30 p-4 rounded-2xl border border-border/40">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold">
                      <Tag className="h-3 w-3 text-primary" /> Aplicar Templates Inteiros
                    </Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {TEMPLATES.map(tpl => (
                        <Button key={tpl.name} variant="outline" size="sm" onClick={() => applyTemplate(tpl)} className="rounded-xl bg-background hover:bg-accent transition-colors">
                          {tpl.emoji} {tpl.name}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 pt-2">
                    <Label className="text-sm font-bold">Itens Individuais</Label>
                    <div className="space-y-2">
                       <Label className="text-[10px] uppercase text-muted-foreground tracking-wider">Histórico de itens:</Label>
                       <Select onValueChange={val => { const s = allAvailableItems.find(i => i.itemName === val); if (s) addDocumentTag(s.itemName, s.stageName, s.itemType); }}>
                        <SelectTrigger className="rounded-xl bg-accent/20 border-border/40 shadow-sm">
                          <SelectValue placeholder="Pesquisar item salvo nos templates..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-2xl">
                          {allAvailableItems.map((it, idx) => (
                            <SelectItem key={idx} value={it.itemName} className="rounded-lg">
                              {it.itemType === "text" ? "📝" : "📎"} {it.itemName} <span className="text-[10px] text-muted-foreground ml-1">({it.stageName})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-[100px_1fr_auto] gap-2">
                      <Input placeholder="Estágio" value={customItemStage} onChange={e => setCustomItemStage(e.target.value)} className="rounded-xl text-xs" />
                      <Input placeholder="Novo item..." value={customItemName} onChange={e => setCustomItemName(e.target.value)} className="rounded-xl text-xs" />
                      <Button variant="outline" size="icon" onClick={addCustomItem} className="rounded-xl shrink-0"><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>

                  {checklistItems.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-3 bg-accent/20 rounded-2xl border border-dashed border-border/60">
                      {checklistItems.map((it, i) => (
                        <Badge key={i} variant="secondary" className="rounded-full pr-1.5 py-1 text-[11px] gap-1.5 bg-background border shadow-sm">
                          {it.itemType === "text" ? "📝" : "📎"} {it.itemName}
                          <button onClick={() => setChecklistItems(checklistItems.filter((_, idx) => idx !== i))} className="ml-1 rounded-full hover:bg-destructive hover:text-white transition-colors p-0.5">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                <DialogFooter className="mt-6 border-t pt-4">
                  <Button onClick={() => createRequest.mutate()} className="w-full rounded-xl gradient-primary h-11 text-base shadow-hero">
                    Gerar Link de Upload ✨
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* STATS OVERVIEW CARDS RESTAURADOS 📊 */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: "Solicitações", value: requests?.length ?? 0, icon: LinkIcon, color: "text-primary", bg: "bg-primary/10" },
            { label: "Pendentes", value: pendingCount, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "Aprovados", value: approvedCount, icon: Check, color: "text-success", bg: "bg-success/10" },
            { label: "Taxa", value: `${uploads?.length ? Math.round((approvedCount/uploads.length)*100) : 0}%`, icon: Sparkles, color: "text-pro", bg: "bg-pro/10" },
          ].map((stat, i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-4 shadow-card hover:shadow-elevated transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.bg}`}><stat.icon className={`h-5 w-5 ${stat.color}`} /></div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </motion.div>

        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="mb-6 rounded-2xl bg-muted/50 p-1">
            <TabsTrigger value="requests" className="rounded-xl gap-2">
              <LinkIcon className="h-4 w-4" /> Solicitações
            </TabsTrigger>
            <TabsTrigger value="files" className="rounded-xl gap-2">
              <FileText className="h-4 w-4" /> Arquivos
            </TabsTrigger>
            <TabsTrigger value="settings" className="rounded-xl gap-2">
              <Settings className="h-4 w-4" /> Configurações
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="requests" className="space-y-4">
             <div className="flex gap-2 mb-4 items-center">
                <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" onClick={() => setViewMode("list")} className="rounded-xl">Lista</Button>
                <Button variant={viewMode === "kanban" ? "default" : "outline"} size="sm" onClick={() => setViewMode("kanban")} className="rounded-xl">Kanban</Button>
                <div className="h-4 w-px bg-border mx-2" />
                <Button variant="ghost" size="sm" onClick={() => setShowArchived(!showArchived)} className="ml-auto rounded-xl text-xs text-muted-foreground gap-1.5">
                  <Archive className="h-3.5 w-3.5" /> {showArchived ? "Ver Ativas" : "Ver Engavetadas"}
                </Button>
             </div>
             
             {requestsLoading ? (
                <div className="space-y-3"><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-32 w-full rounded-2xl" /></div>
             ) : visibleRequests.map((req: any) => (
                <motion.div key={req.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-border/60 bg-card p-5 shadow-sm hover:shadow-elevated transition-all duration-300">
                   <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                      <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                          {req.client_name} 
                          {req.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-success" />}
                          {req.access_password && <LockIcon className="h-3.5 w-3.5 text-pro/60" />}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> Criado em {new Date(req.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/${slug}/enviar/${req.id}`); toast.success("Link copiado!"); }} className="rounded-xl shadow-sm hover:bg-accent">
                          <Copy className="h-3.5 w-3.5 mr-1.5" /> Link
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDownloadZip(req.id, req.client_name)} className="rounded-xl shadow-sm" disabled={downloadingZipId === req.id}>
                          {downloadingZipId === req.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5 mr-1.5" />} ZIP
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => { setSelectedRequest({ id: req.id, clientName: req.client_name }); setManageRequestOpen(true); }} className="rounded-xl text-destructive hover:bg-destructive/10">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                   </div>
                   <div className="flex flex-wrap gap-2">
                      {req.request_items?.map((it: any) => (
                        <Badge key={it.id} variant="outline" className={`rounded-full text-[10px] px-2.5 py-0.5 font-medium transition-colors ${it.is_completed ? 'bg-success/10 text-success border-success/30' : 'bg-muted/50 text-muted-foreground'}`}>
                          {it.item_name}
                        </Badge>
                      ))}
                   </div>
                </motion.div>
             ))}
          </TabsContent>

          <TabsContent value="files">
             <div className="mb-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar arquivos por nome ou cliente..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 rounded-xl bg-card border-border/60" />
             </div>
             <div className="rounded-2xl border border-border/40 overflow-hidden shadow-sm bg-card">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(filteredUploads || []).map((file: any) => (
                      <TableRow key={file.id} className="cursor-pointer hover:bg-accent/40 transition-colors" onClick={() => { setPreviewFile(file); setPreviewOpen(true); }}>
                        <TableCell className="font-semibold text-sm">{file.file_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground font-medium">{file.request_items?.document_requests?.client_name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] px-2 rounded-full font-bold ${
                            file.status === 'approved' ? 'text-success border-success/30 bg-success/5' : 
                            file.status === 'rejected' ? 'text-destructive border-destructive/30 bg-destructive/5' : 
                            'text-amber-600 border-amber-300 bg-amber-50'
                          }`}>
                            {file.status?.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-[11px] text-muted-foreground">{new Date(file.created_at).toLocaleDateString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
             </div>
          </TabsContent>

          {/* TAB DE SETTINGS RESTAURADA COM VISUAL PREMIUM ⚙️ */}
          <TabsContent value="settings">
            <div className="grid gap-6 max-w-2xl">
              <div className="p-6 border border-border/60 rounded-3xl bg-card shadow-card space-y-6">
                <div className="flex items-center gap-3 border-b pb-4">
                  <div className="p-2 bg-primary/10 rounded-xl text-primary"><Building2 className="h-5 w-5" /></div>
                  <h3 className="font-bold text-lg">Perfil da Empresa</h3>
                </div>
                <div className="grid gap-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nome de Exibição</Label>
                    <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="rounded-xl shadow-sm" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">URL Customizada (Slug)</Label>
                    <div className="flex items-center gap-2">
                       <span className="text-sm font-mono text-muted-foreground">/</span>
                       <Input value={slugValue} onChange={e => setSlugValue(e.target.value)} className="rounded-xl font-mono text-sm" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      ownCloud URL (PRO) <Badge variant="outline" className="text-[9px] border-pro/40 text-pro">EXCLUSIVO</Badge>
                    </Label>
                    <Input placeholder="https://seu-servidor.owncloud.com" value={owncloudUrl} onChange={e => setOwncloudUrl(e.target.value)} className="rounded-xl shadow-sm border-pro/20" />
                  </div>
                </div>
                <Button onClick={() => updateSettings.mutate()} className="w-full rounded-xl gradient-primary h-11 shadow-hero hover:shadow-glow transition-all">
                  <Check className="h-4 w-4 mr-2" /> Salvar Alterações
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>

      {/* MODAL DE PREVIEW RESTAURADO COM TODAS AS PROPS 🖼️ */}
      <ErrorBoundary fallbackMessage="Erro ao carregar pré-visualização">
        <FilePreviewModal
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          file={previewFile}
          owncloudUrl={owncloudUrl} 
          onStatusChange={() => {
            queryClient.invalidateQueries({ queryKey: ["uploads", company?.id] });
            queryClient.invalidateQueries({ queryKey: ["requests", company?.id] });
          }}
        />
      </ErrorBoundary>

      {/* MODAL DE GERENCIAMENTO (LIXEIRA) RESTAURADO 🗑️ */}
      <Dialog open={manageRequestOpen} onOpenChange={setManageRequestOpen}>
        <DialogContent className="max-w-sm rounded-3xl text-center p-8">
          <div className="space-y-6">
            <div className="mx-auto w-16 h-16 rounded-3xl bg-destructive/10 flex items-center justify-center animate-pulse">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h3 className="font-bold text-xl">O que deseja fazer?</h3>
              <p className="text-sm text-muted-foreground mt-2 px-4">
                A solicitação de <b>{selectedRequest?.clientName}</b> será gerenciada.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Button variant="outline" className="rounded-xl h-11 gap-2" onClick={() => selectedRequest && archiveRequest.mutate(selectedRequest.id)}>
                <Archive className="h-4 w-4" /> Engavetar (Arquivar)
              </Button>
              <Button variant="destructive" className="rounded-xl h-11 gap-2" onClick={() => selectedRequest && deleteRequest.mutate(selectedRequest.id)}>
                <Trash2 className="h-4 w-4" /> Excluir Permanentemente
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardPage;
