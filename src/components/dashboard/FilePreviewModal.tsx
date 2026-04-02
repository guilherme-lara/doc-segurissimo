import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, X, Download, ExternalLink, Loader2, FileText } from "lucide-react";

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: any;
  owncloudUrl?: string;
  onStatusChange: () => void;
}

export default function FilePreviewModal({ open, onOpenChange, file, owncloudUrl, onStatusChange }: FilePreviewModalProps) {
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Busca a URL pública do arquivo quando o modal abre
  useEffect(() => {
    if (open && file?.file_path) {
      const { data } = supabase.storage.from("uploads").getPublicUrl(file.file_path);
      setPublicUrl(data.publicUrl);
      setShowRejectInput(false);
      setRejectReason("");
    }
  }, [open, file]);

  const handleApprove = async () => {
    if (!file) return;
    setIsApproving(true);
    try {
      // 1. Muda status do upload para Aprovado
      const { error: uploadError } = await supabase
        .from("uploads")
        .update({ status: "approved" })
        .eq("id", file.id);
      if (uploadError) throw uploadError;

      // 2. Muda o item do checklist para Concluído
      const { error: itemError } = await supabase
        .from("request_items")
        .update({ is_completed: true })
        .eq("id", file.request_item_id);
      if (itemError) throw itemError;

      toast.success("Arquivo aprovado com sucesso! ✅");
      
      // Aviso silencioso sobre a nuvem
      if (!owncloudUrl) {
        toast.info("Dica: Você pode conectar seu Google Drive ou ownCloud nas Configurações para backup automático.");
      }

      onStatusChange();
      onOpenChange(false);
    } catch (error: any) {
      console.error("[approve-error]", error);
      toast.error("Erro ao aprovar", { description: error.message });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!file) return;
    if (!rejectReason.trim()) {
      toast.warning("Informe o motivo da rejeição para o cliente.");
      return;
    }
    
    setIsRejecting(true);
    try {
      // 1. Muda status para Rejeitado e salva o motivo
      const { error: uploadError } = await supabase
        .from("uploads")
        .update({ status: "rejected", rejection_reason: rejectReason })
        .eq("id", file.id);
      if (uploadError) throw uploadError;

      // 2. Garante que o item volte a ficar "Pendente" no checklist
      const { error: itemError } = await supabase
        .from("request_items")
        .update({ is_completed: false })
        .eq("id", file.request_item_id);
      if (itemError) throw itemError;

      toast.success("Arquivo rejeitado. O cliente precisará enviar novamente. ❌");
      onStatusChange();
      onOpenChange(false);
    } catch (error: any) {
      console.error("[reject-error]", error);
      toast.error("Erro ao rejeitar", { description: error.message });
    } finally {
      setIsRejecting(false);
    }
  };

  if (!file) return null;

  const isImage = file.content_type?.startsWith("image/");
  const isPDF = file.content_type === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-3xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-5 border-b border-border/40 bg-muted/20">
          <DialogTitle className="text-lg flex items-center justify-between">
            <span className="truncate pr-4">{file.file_name}</span>
            {publicUrl && (
              <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0">
                <ExternalLink className="h-5 w-5" />
              </a>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-5 bg-card/50 flex items-center justify-center min-h-[400px]">
          {isImage && publicUrl ? (
            <img src={publicUrl} alt={file.file_name} className="max-w-full max-h-[60vh] object-contain rounded-xl border shadow-sm" />
          ) : isPDF && publicUrl ? (
            <iframe src={`${publicUrl}#toolbar=0`} className="w-full h-[60vh] rounded-xl border shadow-sm" />
          ) : (
            <div className="text-center text-muted-foreground flex flex-col items-center">
              <FileText className="h-16 w-16 mb-4 opacity-50" />
              <p>Visualização não disponível para este formato.</p>
              {publicUrl && (
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => window.open(publicUrl, "_blank")}>
                  <Download className="mr-2 h-4 w-4" /> Baixar Arquivo
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="p-5 border-t border-border/40 bg-background flex-col sm:flex-row gap-3 sm:justify-between items-center">
          {showRejectInput ? (
            <div className="w-full flex gap-2">
              <Input 
                autoFocus
                placeholder="Motivo da rejeição (ex: Foto tremida, Documento vencido...)" 
                value={rejectReason} 
                onChange={(e) => setRejectReason(e.target.value)}
                className="rounded-xl flex-1"
                onKeyDown={(e) => e.key === "Enter" && handleReject()}
              />
              <Button variant="destructive" onClick={handleReject} disabled={isRejecting} className="rounded-xl">
                {isRejecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirmar"}
              </Button>
              <Button variant="ghost" onClick={() => setShowRejectInput(false)} className="rounded-xl">Cancelar</Button>
            </div>
          ) : (
            <div className="w-full flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setShowRejectInput(true)} className="rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20">
                <X className="mr-2 h-4 w-4" /> Rejeitar Arquivo
              </Button>
              <Button onClick={handleApprove} disabled={isApproving || file.status === 'approved'} className="rounded-xl bg-success hover:bg-success/90 text-white shadow-sm">
                {isApproving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="mr-2 h-4 w-4" />}
                {file.status === 'approved' ? 'Já Aprovado' : 'Aprovar Documento'}
              </Button>
            </div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
