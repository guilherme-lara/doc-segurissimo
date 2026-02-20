import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Shield, Copy, Check, Download, FileText, Settings, LogOut,
  Link as LinkIcon, Plus, Trash2, Tag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ─── Pre-defined document tags the professional can click to add ───
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

// ─── Quick templates ───
const TEMPLATES: { name: string; items: { label: string; stage: string }[] }[] = [
  {
    name: "Kit Admissão",
    items: [
      { label: "RG / CNH", stage: "Documentos Pessoais" },
      { label: "CPF", stage: "Documentos Pessoais" },
      { label: "Comprovante de Residência", stage: "Documentos Pessoais" },
    ],
  },
  {
    name: "Kit Abertura PJ",
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
}

const DashboardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New request dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [customItemName, setCustomItemName] = useState("");

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

  // Fetch requests
  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ["requests", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requests")
        .select("*, request_items(id, item_name, is_completed)")
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
        .select("*")
        .eq("company_id", company!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!company?.id,
  });

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
    if (checklistItems.some((i) => i.itemName === label)) return; // no dupes
    setChecklistItems([...checklistItems, { stageName: stage, itemName: label }]);
  };

  const removeDocumentTag = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const applyTemplate = (template: typeof TEMPLATES[number]) => {
    const merged = [...checklistItems];
    template.items.forEach((t) => {
      if (!merged.some((m) => m.itemName === t.label)) {
        merged.push({ stageName: t.stage, itemName: t.label });
      }
    });
    setChecklistItems(merged);
    toast.success(`Template "${template.name}" aplicado`);
  };

  const addCustomItem = () => {
    const name = customItemName.trim();
    if (!name) return;
    if (checklistItems.some((i) => i.itemName === name)) {
      toast.warning("Documento já adicionado");
      return;
    }
    setChecklistItems([...checklistItems, { stageName: "Outros", itemName: name }]);
    setCustomItemName("");
  };

  // Create request mutation
  const createRequest = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("No company");
      if (!clientName.trim() || checklistItems.length === 0) throw new Error("Preencha o nome e adicione pelo menos um documento");

      const { data: req, error: reqError } = await supabase
        .from("document_requests")
        .insert({ company_id: company.id, client_name: clientName, client_email: clientEmail || null })
        .select()
        .single();
      if (reqError) throw reqError;

      const items = checklistItems.map((item, i) => ({
        request_id: req.id,
        stage_name: item.stageName,
        item_name: item.itemName,
        sort_order: i,
      }));
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
      toast.success("Solicitação criada com sucesso!");
    },
    onError: (err: any) => {
      toast.error("Erro ao criar solicitação", { description: err.message });
    },
  });

  // Update settings
  const updateSettings = useMutation({
    mutationFn: async () => {
      if (!company) return;
      const { error } = await supabase
        .from("companies")
        .update({ display_name: displayName, slug: slugValue })
        .eq("id", company.id);
      if (error) throw error;
      if (slugValue !== slug) navigate(`/${slugValue}/dashboard`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company"] });
      toast.success("Configurações salvas!");
    },
  });

  const handleCopy = (requestId: string) => {
    const link = `${window.location.origin}/${slug}/enviar/${requestId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(requestId);
    toast.success("Link copiado para a área de transferência!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("pt-BR");

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Portal Seguríssimo</span>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Actions */}
        <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            {companyLoading ? (
              <Skeleton className="h-8 w-48" />
            ) : (
              <>
                <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
                <p className="text-sm text-muted-foreground">Gerencie suas solicitações de documentos</p>
              </>
            )}
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nova Solicitação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Nova Solicitação de Documentos</DialogTitle>
              </DialogHeader>
              <div className="space-y-5 mt-4">
                <div className="space-y-2">
                  <Label>Nome do Cliente</Label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex: João Silva" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail do Cliente (opcional)</Label>
                  <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="cliente@email.com" type="email" />
                </div>

                {/* Templates rápidos */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" /> Templates Prontos</Label>
                  <div className="flex flex-wrap gap-2">
                    {TEMPLATES.map((tpl) => (
                      <Button key={tpl.name} variant="outline" size="sm" onClick={() => applyTemplate(tpl)} type="button">
                        {tpl.name}
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
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                            isAdded
                              ? "border-primary/30 bg-primary/10 text-primary cursor-default"
                              : "border-border bg-card text-foreground hover:border-primary hover:bg-primary/5 cursor-pointer"
                          }`}
                        >
                          {isAdded && <Check className="mr-1 h-3 w-3" />}
                          {doc.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom document */}
                <div className="space-y-2">
                  <Label>Adicionar Outro</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Nome do documento..."
                      value={customItemName}
                      onChange={(e) => setCustomItemName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomItem())}
                    />
                    <Button variant="outline" size="icon" onClick={addCustomItem} type="button">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Selected items */}
                {checklistItems.length > 0 && (
                  <div className="space-y-2">
                    <Label>Documentos selecionados ({checklistItems.length})</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {checklistItems.map((item, i) => (
                        <Badge key={i} variant="secondary" className="gap-1 pr-1">
                          {item.itemName}
                          <button type="button" onClick={() => removeDocumentTag(i)} className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 transition-colors">
                            <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter className="mt-4">
                <Button onClick={() => createRequest.mutate()} disabled={createRequest.isPending || checklistItems.length === 0}>
                  {createRequest.isPending ? "Criando..." : "Criar Solicitação"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Tabs defaultValue="requests" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="requests">
              <LinkIcon className="mr-2 h-4 w-4" /> Solicitações
            </TabsTrigger>
            <TabsTrigger value="files">
              <FileText className="mr-2 h-4 w-4" /> Arquivos
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" /> Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests">
            <div className="space-y-3">
              {requestsLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28 w-full rounded-xl" />
                ))
              ) : requests?.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="mx-auto h-10 w-10 mb-3 text-border" />
                  <p>Nenhuma solicitação criada ainda.</p>
                  <p className="text-sm">Clique em "Nova Solicitação" para começar.</p>
                </div>
              ) : (
                requests?.map((req: any) => {
                  const completed = req.request_items?.filter((i: any) => i.is_completed).length ?? 0;
                  const total = req.request_items?.length ?? 0;
                  return (
                    <div key={req.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-card-foreground">{req.client_name}</h3>
                          <p className="text-xs text-muted-foreground">{formatDate(req.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            completed === total && total > 0
                              ? "bg-success/10 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}>
                            {completed}/{total} enviados
                          </span>
                          <Button variant="outline" size="sm" onClick={() => handleCopy(req.id)}>
                            {copiedId === req.id ? (
                              <><Check className="mr-1 h-3 w-3 text-success" /> Copiado</>
                            ) : (
                              <><Copy className="mr-1 h-3 w-3" /> Copiar link</>
                            )}
                          </Button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {req.request_items?.map((item: any) => (
                          <span key={item.id} className={`text-xs px-2 py-0.5 rounded ${
                            item.is_completed ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                          }`}>
                            {item.item_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </TabsContent>

          <TabsContent value="files">
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-8 ml-auto" /></TableCell>
                      </TableRow>
                    ))
                  ) : uploads?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum arquivo recebido ainda.
                      </TableCell>
                    </TableRow>
                  ) : (
                    uploads?.map((file: any) => (
                      <TableRow key={file.id}>
                        <TableCell className="font-medium">{file.file_name}</TableCell>
                        <TableCell className="text-muted-foreground">{formatSize(file.file_size)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatDate(file.created_at)}</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm">
                            <Download className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Configurações da Conta</h3>
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="display-name">Nome de Exibição</Label>
                  <Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug da URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground whitespace-nowrap">/{""}</span>
                    <Input id="slug" value={slugValue} onChange={(e) => setSlugValue(e.target.value)} />
                    <span className="text-sm text-muted-foreground">/enviar</span>
                  </div>
                </div>
                <Button onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? "Salvando..." : "Salvar alterações"}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default DashboardPage;
