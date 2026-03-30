import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Crown, FileText, Trash2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

const TemplatesPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  
  // Estado do formulário
  const [templateName, setTemplateName] = useState("");
  const [items, setItems] = useState([{ itemName: "", stageName: "Geral" }]);

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
    enabled: !!companyId && isPro, // Só busca se for PRO
  });

  // 3. Salvar novo template
  const createTemplate = useMutation({
    mutationFn: async () => {
      if (!templateName) throw new Error("Dê um nome ao template");
      if (items.some(i => !i.itemName)) throw new Error("Preencha todos os nomes dos itens");

      // Cria o template
      const { data: template, error: templateError } = await supabase
        .from("templates")
        .insert({ company_id: companyId, name: templateName })
        .select()
        .single();

      if (templateError) throw templateError;

      // Cria os itens do template
      const itemsToInsert = items.map((item, index) => ({
        template_id: template.id,
        item_name: item.itemName,
        stage_name: item.stageName,
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
      setItems([{ itemName: "", stageName: "Geral" }]);
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

      {/* PAYWALL - Se não for PRO */}
      {!isPro ? (
        <div className="bg-card border border-primary/20 rounded-2xl p-10 text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-purple-500" />
          <Crown className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">Crie Checklists Automáticos</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Faça upgrade para o plano PRO e pare de digitar os mesmos documentos toda vez. Crie templates reutilizáveis para Abertura de Empresa, Imposto de Renda e muito mais.
          </p>
          <Button size="lg" className="gradient-primary text-white" onClick={() => window.open("SEU_LINK_DA_INFINITEPAY_AQUI", "_blank")}>
            Desbloquear PRO por R$ 49/mês
          </Button>
        </div>
      ) : (
        /* ÁREA PRO - Gestão de Templates */
        <div>
          <div className="flex justify-between items-center mb-6">
            <p className="text-muted-foreground">Gerencie seus checklists padronizados.</p>
            
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
              <DialogTrigger asChild>
                <Button className="gradient-primary"><Plus className="w-4 h-4 mr-2" /> Novo Template</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Criar Novo Template</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4">
                  <div className="space-y-2">
                    <Label>Nome do Template (ex: Abertura Simples Nacional)</Label>
                    <Input value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Digite o nome..." />
                  </div>

                  <div className="space-y-4">
                    <Label>Documentos Solicitados</Label>
                    {items.map((item, index) => (
                      <div key={index} className="flex gap-3 items-start">
                        <Input 
                          placeholder="Categoria (ex: Sócios)" 
                          className="w-1/3"
                          value={item.stageName}
                          onChange={e => {
                            const newItems = [...items];
                            newItems[index].stageName = e.target.value;
                            setItems(newItems);
                          }}
                        />
                        <Input 
                          placeholder="Nome do Documento (ex: RG do Sócio)" 
                          className="flex-1"
                          value={item.itemName}
                          onChange={e => {
                            const newItems = [...items];
                            newItems[index].itemName = e.target.value;
                            setItems(newItems);
                          }}
                        />
                        <Button variant="destructive" size="icon" onClick={() => setItems(items.filter((_, i) => i !== index))} disabled={items.length === 1}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" type="button" onClick={() => setItems([...items, { itemName: "", stageName: "Geral" }])}>
                      <Plus className="w-4 h-4 mr-2" /> Adicionar Documento
                    </Button>
                  </div>

                  <Button className="w-full" onClick={() => createTemplate.mutate()} disabled={createTemplate.isPending}>
                    {createTemplate.isPending ? "Salvando..." : "Salvar Template"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Lista de Templates */}
          {isLoadingTemplates ? <p>Carregando templates...</p> : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates?.map((t: any) => (
                <div key={t.id} className="p-5 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-primary/10 text-primary rounded-lg"><FileText className="w-5 h-5" /></div>
                    <h3 className="font-semibold text-lg truncate">{t.name}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">{t.template_items?.length || 0} documentos na lista</p>
                  <Button variant="secondary" className="w-full text-xs" onClick={() => toast.info("Edição em breve!")}>Editar Checklist</Button>
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

export default TemplatesPage;
