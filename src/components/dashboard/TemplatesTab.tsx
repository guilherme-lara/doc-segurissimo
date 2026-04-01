/**
 * TemplatesTab — Gerenciamento de templates de documentos (PRO)
 *
 * Permite criar, editar e excluir kits de documentos reutilizáveis.
 */

import { useState } from "react";
import { Plus, Trash2, BookTemplate, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface TemplatesTabProps {
  companyId: string | undefined;
}

const EMOJI_OPTIONS = ["📋", "🏢", "📑", "💼", "🏠", "📦", "🎓", "⚖️", "🏥", "🚗"];

export default function TemplatesTab({ companyId }: TemplatesTabProps) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateEmoji, setTemplateEmoji] = useState("📋");
  const [templateItems, setTemplateItems] = useState<{ itemName: string; stageName: string; itemType: string }[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemStage, setNewItemStage] = useState("Geral");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*, document_template_items(*)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const createTemplate = useMutation({
    mutationFn: async () => {
      if (!companyId || !templateName.trim() || templateItems.length === 0) {
        throw new Error("Preencha o nome e adicione pelo menos um item");
      }

      const { data: tpl, error: tplError } = await supabase
        .from("document_templates")
        .insert({ company_id: companyId, name: templateName.trim(), emoji: templateEmoji })
        .select()
        .single();
      if (tplError) throw tplError;

      const items = templateItems.map((item, i) => ({
        template_id: tpl.id,
        item_name: item.itemName,
        stage_name: item.stageName,
        item_type: item.itemType,
        sort_order: i,
      }));

      const { error: itemsError } = await supabase.from("document_template_items").insert(items);
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setCreateOpen(false);
      setTemplateName("");
      setTemplateEmoji("📋");
      setTemplateItems([]);
      toast.success("Template criado com sucesso! 🎉");
    },
    onError: (err: any) => toast.error("Erro ao criar template", { description: err.message }),
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("document_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template excluído! 🗑️");
    },
    onError: (err: any) => toast.error("Erro ao excluir", { description: err.message }),
  });

  const addItem = () => {
    const name = newItemName.trim();
    if (!name) return;
    if (templateItems.some((i) => i.itemName === name)) {
      toast.warning("Item já adicionado");
      return;
    }
    setTemplateItems([...templateItems, { itemName: name, stageName: newItemStage, itemType: "file" }]);
    setNewItemName("");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-foreground">Templates de Documentos</h3>
          <p className="text-sm text-muted-foreground">Crie kits reutilizáveis para agilizar suas solicitações</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="rounded-xl gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300">
          <Plus className="mr-2 h-4 w-4" /> Novo Template
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border/60 bg-card p-5 animate-pulse h-24" />
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center py-16">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
            <BookTemplate className="h-8 w-8 text-primary/40" />
          </div>
          <p className="text-lg font-bold text-foreground mb-1">Nenhum template criado 📋</p>
          <p className="text-sm text-muted-foreground">Crie seu primeiro kit de documentos para reutilizar nas solicitações.</p>
        </motion.div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {templates.map((tpl: any) => (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border/60 bg-card p-5 shadow-card hover:shadow-elevated transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{tpl.emoji}</span>
                  <div>
                    <h4 className="font-semibold text-foreground">{tpl.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {tpl.document_template_items?.length ?? 0} itens
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:bg-destructive/10 rounded-xl"
                  onClick={() => deleteTemplate.mutate(tpl.id)}
                  disabled={deleteTemplate.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {tpl.document_template_items?.map((item: any) => (
                  <Badge key={item.id} variant="secondary" className="rounded-full text-xs">
                    {item.item_type === "text" ? "📝" : "📎"} {item.item_name}
                  </Badge>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Template Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto rounded-3xl">
          <DialogHeader>
            <DialogTitle>Novo Template 📋</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome do Template</Label>
              <Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="Ex: Kit Admissão" className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Ícone</Label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => setTemplateEmoji(emoji)}
                    className={`h-10 w-10 rounded-xl border text-lg flex items-center justify-center transition-all ${
                      templateEmoji === emoji ? "border-primary bg-primary/10 scale-110" : "border-border hover:border-primary/50"
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Adicionar Item</Label>
              <div className="flex gap-2">
                <Input placeholder="Nome do documento..." value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())} className="rounded-xl" />
                <Input placeholder="Etapa" value={newItemStage} onChange={(e) => setNewItemStage(e.target.value)} className="rounded-xl w-28" />
                <Button variant="outline" size="icon" onClick={addItem} className="rounded-xl shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {templateItems.length > 0 && (
              <div className="space-y-2">
                <Label>Itens ({templateItems.length})</Label>
                <div className="flex flex-wrap gap-1.5">
                  {templateItems.map((item, i) => (
                    <Badge key={i} variant="secondary" className="gap-1 pr-1 rounded-full">
                      📎 {item.itemName}
                      <button type="button" onClick={() => setTemplateItems(templateItems.filter((_, j) => j !== i))} className="ml-0.5 rounded-full p-0.5 hover:bg-destructive/20 transition-colors">
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button
              onClick={() => createTemplate.mutate()}
              disabled={createTemplate.isPending || !templateName.trim() || templateItems.length === 0}
              className="rounded-xl gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300"
            >
              {createTemplate.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Criando...</> : "Criar Template ✨"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
