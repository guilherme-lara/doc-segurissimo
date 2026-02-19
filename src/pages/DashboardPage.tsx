import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Shield, Copy, Check, Download, FileText, Settings, LogOut,
  Link as LinkIcon, Plus, Trash2, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface ChecklistItem {
  stageName: string;
  itemName: string;
}

const DashboardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // New request dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([
    { stageName: "Documentos Pessoais", itemName: "" },
  ]);

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
  const { data: company } = useQuery({
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
  const { data: requests } = useQuery({
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
  const { data: uploads } = useQuery({
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

  // Create request mutation
  const createRequest = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("No company");
      const validItems = checklistItems.filter((i) => i.itemName.trim());
      if (!clientName.trim() || validItems.length === 0) throw new Error("Preencha todos os campos");

      const { data: req, error: reqError } = await supabase
        .from("document_requests")
        .insert({ company_id: company.id, client_name: clientName, client_email: clientEmail || null })
        .select()
        .single();
      if (reqError) throw reqError;

      const items = validItems.map((item, i) => ({
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
      setChecklistItems([{ stageName: "Documentos Pessoais", itemName: "" }]);
      toast({ title: "Solicitação criada com sucesso!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
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
      toast({ title: "Configurações salvas!" });
    },
  });

  const handleCopy = (requestId: string) => {
    const link = `${window.location.origin}/${slug}/enviar/${requestId}`;
    navigator.clipboard.writeText(link);
    setCopiedId(requestId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  const addChecklistItem = () => {
    setChecklistItems([...checklistItems, { stageName: "Documentos Pessoais", itemName: "" }]);
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const updateChecklistItem = (index: number, field: keyof ChecklistItem, value: string) => {
    const updated = [...checklistItems];
    updated[index] = { ...updated[index], [field]: value };
    setChecklistItems(updated);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("pt-BR");
  };

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
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Gerencie suas solicitações de documentos</p>
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
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Nome do Cliente</Label>
                  <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Ex: João Silva" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail do Cliente (opcional)</Label>
                  <Input value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="cliente@email.com" type="email" />
                </div>
                <div className="space-y-2">
                  <Label>Documentos Solicitados</Label>
                  <div className="space-y-2">
                    {checklistItems.map((item, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          placeholder="Etapa (ex: Pessoais)"
                          value={item.stageName}
                          onChange={(e) => updateChecklistItem(i, "stageName", e.target.value)}
                          className="w-1/3"
                        />
                        <Input
                          placeholder="Documento (ex: RG)"
                          value={item.itemName}
                          onChange={(e) => updateChecklistItem(i, "itemName", e.target.value)}
                          className="flex-1"
                        />
                        {checklistItems.length > 1 && (
                          <Button variant="ghost" size="icon" onClick={() => removeChecklistItem(i)}>
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={addChecklistItem} className="mt-2">
                    <Plus className="mr-2 h-3 w-3" /> Adicionar item
                  </Button>
                </div>
              </div>
              <DialogFooter className="mt-4">
                <Button onClick={() => createRequest.mutate()} disabled={createRequest.isPending}>
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
              {requests?.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="mx-auto h-10 w-10 mb-3 text-border" />
                  <p>Nenhuma solicitação criada ainda.</p>
                  <p className="text-sm">Clique em "Nova Solicitação" para começar.</p>
                </div>
              )}
              {requests?.map((req: any) => {
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
              })}
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
                  {uploads?.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum arquivo recebido ainda.
                      </TableCell>
                    </TableRow>
                  )}
                  {uploads?.map((file: any) => (
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
                  ))}
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
