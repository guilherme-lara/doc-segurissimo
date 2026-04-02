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
  owncloudUrl?: string; 
  onStatusChange?: () => void;
}

const FilePreviewModal = ({ open, onOpenChange, file, onStatusChange, owncloudUrl }: FilePreviewModalProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    if (!open || !file) return;
    setLoading(true);
    supabase.storage.from("uploads").createSignedUrl(file.file_path, 600).then(({ data }) => {
      setSignedUrl(data?.signedUrl || null);
      setLoading(false);
    });
  }, [open, file]);

  const handleApprove = async () => {
    if (!file || updating) return;
    setUpdating(true);
    
    // 1. Atualiza o banco primário
    const { error } = await supabase.from("uploads").update({ status: "approved", rejection_reason: null }).eq("id", file.id);
      
    if (error) {
      toast.error("Erro ao aprovar");
      setUpdating(false);
      return;
    }

    toast.success("Aprovado! ✅");
    
    // 2. ATUALIZA A TELA NA HORA
    onStatusChange?.(); 
    setUpdating(false);
    onOpenChange(false);

    // 3. Sincroniza em background (Não trava a UI)
    if (owncloudUrl) {
      supabase.functions.invoke("owncloud-sync", { body: { uploadId: file.id } })
        .catch(e => console.error("ownCloud sync background error:", e));
    }
  };

  const handleReject = async () => {
    if (!file || !rejectionReason.trim()) return;
    setUpdating(true);
    const { error } = await supabase.from("uploads").update({ status: "rejected", rejection_reason: rejectionReason.trim() }).eq("id", file.id);
    
    if (!error) {
      toast.success("Rejeitado!");
      onStatusChange?.();
      onOpenChange(false);
    }
    setUpdating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-3xl">
        <DialogHeader><DialogTitle>{file?.file_name || "Visualizar"}</DialogTitle></DialogHeader>
        <div className="mt-2 rounded-2xl bg-muted/50 border min-h-[300px] flex items-center justify-center overflow-hidden">
          {loading ? <Loader2 className="animate-spin" /> : file?.content_type?.startsWith("image/") ? <img src={signedUrl!} className="max-h-[60vh] object-contain" /> : <FileText className="h-12 w-12 text-muted-foreground" />}
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={handleApprove} disabled={updating}>Aprovar ✅</Button>
          <Button variant="outline" className="flex-1 rounded-xl" onClick={() => setShowRejectForm(true)} disabled={updating}>Rejeitar ❌</Button>
        </div>
        {showRejectForm && (
          <div className="mt-4 space-y-2">
            <Label>Motivo</Label>
            <Textarea value={rejectionReason} onChange={e => setRejectionReason(e.target.value)} className="rounded-xl" />
            <Button variant="destructive" className="w-full rounded-xl" onClick={handleReject}>Confirmar Rejeição</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewModal;
