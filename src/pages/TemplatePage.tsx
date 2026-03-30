import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Crown, FileText, Trash2, ArrowLeft, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

// ─── Documentos Padrão do Sistema ───
const COMMON_DOCUMENTS = [
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

const TEMPLATES = [
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
  itemType: "file" | "text";
}

const TemplatePage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  
  // Estado do formulário
  const [templateName, setTemplateName] = useState("");
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [customItemStage, setCustomItemStage] = useState("");
  const [customItemName, setCustomItemName] = useState("");
  const [customItemType, setCustomItemType] = useState<"file" | "text">("file");

  // 1. Buscar a empresa do usuário logado e o plano
  const { data: companyData, isLoading: isLoadingCompany } = useQuery({
    queryKey: ["my-company-plan"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não logado");

      const { data: company } = await supabase
        .from("companies")
        .select("id, slug, user_plans(plan)")
        .eq("user_id", user.id)
        .single();
        
      return company;
    }
  });

  const companyId = companyData?.id;
  const isPro = (Array.isArray(companyData?.user_plans) ? companyData.user_plans[0]?.plan : companyData?.user_plans?.plan) === "pro";

  // 2. Buscar os templates criados
  const { data: templates, isLoading: isLoadingTemplates } = useQuery({
    queryKey: ["my-templates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("*, template_items(*)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!companyId && isPro,
  });

  // ─── Lógica para o Dropdown Inteligente de Itens ───
  const allAvailableItems = useMemo(() => {
    const itemsMap = new Map<string, { stageName: string; itemName: string; itemType: "file" | "text" }>();

    // Itens padrão
    COMMON_DOCUMENTS.forEach(doc => {
      itemsMap.set(doc.label, { stageName: doc.stage, itemName: doc.label, itemType: "file" });
    });

    TEMPLATES.forEach(tpl => {
      tpl.items.forEach(item => {
        itemsMap.set(item.label, { stageName: item.stage, itemName: item.label, itemType: "file" });
      });
    });

    // Itens dos templates já criados pelo usuário no banco
    if (templates) {
      templates.forEach((tpl: any) => {
        tpl.template_items?.forEach((tItem: any) => {
          itemsMap.set(tItem.item_name, { 
            stageName: tItem.stage_name, 
            itemName: tItem.item_name, 
            itemType: tItem.item_type || "file" 
          });
        });
      });
    }

    // Retorna ordenado alfabeticamente
    return Array.from(itemsMap.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [templates]);

  // ─── Funções de manipulação do checklist ───
  const addDocumentTag = (label: string, stage: string, type: "file" | "text" = "file") => {
    if (checklistItems.some((i) => i.itemName === label)) {
      toast.warning("Este item já está no seu template");
      return;
    }
    setChecklistItems([...checklistItems, { stageName: stage, itemName: label, itemType: type }]);
  };

  const removeDocumentTag = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  const addCustomItem = () => {
    const name = customItemName.trim();
    const stage = customItemStage.trim() || "Geral";
    if (!name) return;
    if (checklistItems.some((i) => i.itemName === name)) {
      toast.warning("Documento já adicionado");
      return;
    }
    setChecklistItems([...checklistItems, { stageName: stage, itemName: name, itemType: customItemType }]);
    setCustomItemName("");
    // Mantém o customItemStage preenchido para ele adicionar rápido vários na mesma categoria
  };

  // 3. Salvar novo template
  const createTemplate = useMutation({
    mutationFn: async () => {
      if (!templateName) throw new Error("Dê um nome ao template");
      if (checklistItems.length === 0) throw new Error("Adicione pelo menos um item ao template");

      const { data: template, error: templateError } = await supabase
        .from("templates")
        .insert({ company_id: companyId, name: templateName })
        .select()
        .single();

      if (templateError) throw templateError;

      const itemsToInsert = checklistItems.map((item, index) => ({
        template_id: template.id,
        item_name: item.itemName,
        stage_name: item.stageName,
        item_type: item.itemType,
        sort_order: index
      }));

      const { error: itemsError } = await supabase
        .from("template_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success("Template criado com sucesso!");
      setIsOpen(false);
      setTemplateName("");
      setChecklistItems([]);
      setCustomItemStage("");
      setCustomItemName("");
      queryClient.invalidateQueries({ queryKey: ["my-templates"] });
    },
    onError: (e: any) => toast.error(e.message)
  });

  if (isLoadingCompany) return <div className="p-8">Carregando...</div>;

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" size="icon" onClick={() => navigate(`/${companyData?.slug}/dashboard`)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-3xl font-bold">Meus Templates</h1>
      </div>

      {!isPro ? (
        <div className="bg-card border border-primary/20 rounded-2xl p-10 text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-500" />
          <Crown className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">Crie Checklists Automáticos</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Faça upgrade para o plano PRO e pare de digitar os mesmos documentos toda vez. Crie templates reutilizáveis para Abertura de Empresa, Imposto de Renda e muito mais.
          </p>
          <Button size="lg" className="gradient-primary text-white">
            Desbloquear PRO por R$ 49/mês
          </Button>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-6">
            <p className="text-muted-foreground">Gerencie seus checklists padronizados.</p>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary"><Plus className="w-4 h-4 mr-2" /> Novo Template</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
                <DialogHeader>
                  <DialogTitle>Criar Novo Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label>Nome do Template (ex: Abertura Simples Nacional)</Label>
                    <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Digite o nome..." className="rounded-xl" />
                  </div>

                  <div className="space-y-4 pt-2">
                    <Label className="text-base font-semibold border-b border-border/40 pb-2 flex block w-full">Adicionar Documentos</Label>
                    
                    {/* DROPDOWN MÁGICO */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Puxar do seu histórico de itens:</Label>
                      <Select onValueChange={(val) => {
                          const selected = allAvailableItems.find(i => i.itemName === val);
                          if (selected) {
                            addDocumentTag(selected.itemName, selected.stageName, selected.itemType);
                          }
                        }}>
                        <SelectTrigger className="w-full rounded-xl bg-accent/20">
                          <SelectValue placeholder="Selecione um item salvo no banco..." />
                        </SelectTrigger>
                        <SelectContent>
                          {allAvailableItems.map((item, idx) => (
                            <SelectItem key={idx} value={item.itemName}>
                              {item.itemType === "text" ? "📝" : "📎"} {item.itemName} <span className="text-muted-foreground ml-1">({item.stageName})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2 py-1">
                      <div className="h-px flex-1 bg-border/60" />
                      <span className="text-[10px] text-muted-foreground font-semibold tracking-wider uppercase">OU CRIE UM ITEM INÉDITO</span>
                      <div className="h-px flex-1 bg-border/60" />
                    </div>

                    {/* INPUTS PARA ITEM NOVO */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Categoria (ex: Financeiro)"
                        value={customItemStage}
                        onChange={(e) => setCustomItemStage(e.target.value)}
                        className="rounded-xl w-[140px] shrink-0"
                      />
                      <Input
                        placeholder={customItemType === "text" ? "Ex: Qual a cor da fachada?" : "Nome do documento..."}
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomItem())}
                        className="rounded-xl flex-1"
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
                  </div>

                  {/* CHECKLIST FINAL (BADGES) */}
                  <div className="space-y-3 bg-accent/20 p-4 rounded-2xl border border-border/40 mt-4 min-h-[100px]">
                    <Label>Itens do Template ({checklistItems.length})</Label>
                    {checklistItems.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum item adicionado ainda.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {checklistItems.map((item, i) => (
                          <Badge key={i} variant="secondary" className="gap-1 pr-1.5 py-1 rounded-full text-xs font-medium bg-background border border-border/50">
                            {item.itemType === "text" ? "📝" : "📎"} {item.itemName}
                            <span className="text-[10px] text-muted-foreground ml-1">({item.stageName})</span>
                            <button type="button" onClick={() => removeDocumentTag(i)} className="ml-1 rounded-full p-0.5 hover:bg-destructive hover:text-white transition-colors">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button className="w-full rounded-xl h-11" onClick={() => createTemplate.mutate()} disabled={createTemplate.isPending || checklistItems.length === 0}>
                    {createTemplate.isPending ? "Salvando..." : "Salvar Template ✨"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {isLoadingTemplates ? <p>Carregando templates...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates?.map((t: any) => (
                <div key={t.id} className="p-5 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg"><FileText className="w-5 h-5" /></div>
                    <h3 className="font-semibold text-lg truncate">{t.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{t.template_items?.length || 0} itens</p>
                  <Button variant="secondary" className="w-full text-xs rounded-xl" onClick={() => toast.info("Edição em breve!")}>Editar Template</Button>
                </div>
              ))}
              {templates?.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
                  Nenhum template criado ainda.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TemplatePage;
