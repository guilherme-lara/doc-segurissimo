import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Download, FileText, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: any;
  owncloudUrl?: string; // Prop adicionada para controle PRO
  onStatusChange?: () => void;
}

const FilePreviewModal = ({ open, onOpenChange, file, onStatusChange, owncloudUrl }: FilePreviewModalProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [pdfLoadFailed, setPdfLoadFailed] = useState(false);

  const isImage = file?.content_type?.startsWith("image/");
  const isPdf = file?.content_type === "application/pdf";

  useEffect(() => {
    if (!open || !file) {
      setSignedUrl(null);
      setShowRejectForm(false);
      setRejectionReason("");
      setPdfLoadFailed(false);
      return;
    }
    setLoading(true);
    setPdfLoadFailed(false);
    supabase.storage.from("uploads").createSignedUrl(file.file_path, 300).then(({ data, error }) => {
      if (error) toast.error("Erro ao carregar preview");
      else setSignedUrl(data.signedUrl);
      setLoading(false);
    });
  }, [open, file]);

  const handleApprove = async () => {
    if (!file) return;
    setUpdating(true);
    
    // 1. Atualiza o banco
    const { error } = await supabase
      .from("uploads")
      .update({ status: "approved", rejection_reason: null } as any)
      .eq("id", file.id);
      
    if (error) {
      setUpdating(false);
      toast.error("Erro ao aprovar");
      return;
    }

    toast.success("Arquivo aprovado ✅");
    
    // 2. Notifica o Dashboard para recarregar IMEDIATAMENTE
    onStatusChange?.();
    setUpdating(false);
    onOpenChange(false);

    // 3. Condicional Inteligente do ownCloud
    if (owncloudUrl) {
      console.log("[owncloud-sync] Iniciando sincronização...");
      supabase.functions.invoke("owncloud-sync", { body: { uploadId: file.id } })
        .then(res => {
          if (!res.error) toast.success("Sincronizado com ownCloud ☁️");
        })
        .catch(err => console.error("Erro sync:", err));
    } else {
      console.log("[owncloud-sync] ownCloud não configurado. Ignorando sincronização.");
    }
  };

  const handleReject = async () => {
    if (!file || !rejectionReason.trim()) return;
    setUpdating(true);
    const { error } = await supabase
      .from("uploads")
      .update({ status: "rejected", rejection_reason: rejectionReason.trim() } as any)
      .eq("id", file.id);
    
    setUpdating(false);
    if (error) { toast.error("Erro ao rejeitar"); return; }
    
    toast.success("Arquivo rejeitado ❌");
    onStatusChange?.();
    onOpenChange(false);
  };

  const handleDownload = () => {
    if (!signedUrl) return;
    const a = document.createElement("a");
    a.href = signedUrl;
    a.download = file?.file_name ?? "arquivo";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader><DialogTitle>{file?.file_name ?? "Arquivo"}</DialogTitle></DialogHeader>
        <div className="mt-2 rounded-2xl bg-muted/50 border min-h-[300px] flex items-center justify-center overflow-hidden">
          {loading ? <Loader2 className="animate-spin" /> : isImage ? <img src={signedUrl!} className="max-h-[60vh] object-contain" /> : <p className="text-sm">Preview indisponível</p>}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={handleApprove} disabled={updating || file?.status === "approved"}>
             <CheckCircle2 className="mr-2 h-4 w-4 text-success" /> Aprovar
          </Button>
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowRejectForm(true)} disabled={updating}>
             <XCircle className="mr-2 h-4 w-4 text-destructive" /> Rejeitar
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={handleDownload} disabled={!signedUrl}><Download className="h-4 w-4" /></Button>
        </div>
        {showRejectForm && (
          <div className="mt-4 space-y-2">
            <Label>Motivo da rejeição</Label>
            <Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="rounded-xl" />
            <Button variant="destructive" className="w-full rounded-xl" onClick={handleReject}>Confirmar Rejeição</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewModal;
