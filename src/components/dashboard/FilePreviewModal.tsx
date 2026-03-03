/**
 * FilePreviewModal — Modal de pré-visualização para o profissional
 *
 * Exibe imagens via <img> e PDFs via <iframe>.
 * Botões de Aprovar (✅), Rejeitar (❌) e Baixar (⬇️).
 * Rejeição inclui campo de motivo (rejection_reason).
 *
 * NOTA para migração: O Signed URL é gerado via supabase.storage.createSignedUrl.
 * No servidor próprio, usar endpoint equivalente com autenticação JWT.
 *
 * SCHEMA: uploads.rejection_reason TEXT (nullable)
 * Quando status='rejected', o motivo é salvo e exibido ao cliente.
 */
import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Download, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FilePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  file: {
    id: string;
    file_name: string;
    file_path: string;
    file_size: number;
    content_type: string | null;
    status: string;
    rejection_reason?: string | null;
    created_at: string;
  } | null;
  onStatusChange?: () => void;
}

const FilePreviewModal = ({ open, onOpenChange, file, onStatusChange }: FilePreviewModalProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const isImage = file?.content_type?.startsWith("image/");
  const isPdf = file?.content_type === "application/pdf";

  useEffect(() => {
    if (!open || !file) {
      setSignedUrl(null);
      setShowRejectForm(false);
      setRejectionReason("");
      return;
    }
    setLoading(true);
    supabase.storage
      .from("uploads")
      .createSignedUrl(file.file_path, 300)
      .then(({ data, error }) => {
        if (error) {
          toast.error("Erro ao carregar preview");
        } else {
          setSignedUrl(data.signedUrl);
        }
        setLoading(false);
      });
  }, [open, file]);

  const handleApprove = async () => {
    if (!file) return;
    setUpdating(true);
    console.log("[approve] Approving file:", file.id, file.file_name);
    const { error } = await supabase
      .from("uploads")
      .update({ status: "approved", rejection_reason: null } as any)
      .eq("id", file.id);
    setUpdating(false);
    if (error) {
      console.error("[approve] Error:", error.message);
      toast.error("Erro ao aprovar");
      return;
    }
    console.log("[approve] ✅ File approved, triggering ownCloud sync...");
    toast.success("Arquivo aprovado ✅");

    // Trigger OwnCloud sync (PRO) — fire and forget
    try {
      const res = await supabase.functions.invoke("owncloud-sync", {
        body: { uploadId: file.id },
      });
      if (res.error) {
        console.warn("[owncloud-sync] Sync skipped or failed:", res.error);
      } else {
        console.log("[owncloud-sync] ✅ Sync response:", res.data);
      }
    } catch (syncErr) {
      console.warn("[owncloud-sync] Edge function call failed (may not be configured):", syncErr);
    }

    onStatusChange?.();
    onOpenChange(false);
  };

  const handleReject = async () => {
    if (!file || !rejectionReason.trim()) {
      toast.warning("Informe o motivo da rejeição");
      return;
    }
    setUpdating(true);
    console.log("[reject] Rejecting file:", file.id, "reason:", rejectionReason.trim());
    const { error } = await supabase
      .from("uploads")
      .update({ status: "rejected", rejection_reason: rejectionReason.trim() } as any)
      .eq("id", file.id);
    setUpdating(false);
    if (error) {
      console.error("[reject] Error:", error.message);
      toast.error("Erro ao rejeitar");
      return;
    }
    console.log("[reject] ❌ File rejected successfully");
    toast.success("Arquivo rejeitado ❌");
    setShowRejectForm(false);
    setRejectionReason("");
    onStatusChange?.();
    onOpenChange(false);
  };

  const handleDownload = () => {
    if (signedUrl) {
      const a = document.createElement("a");
      a.href = signedUrl;
      a.download = file?.file_name ?? "arquivo";
      a.target = "_blank";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            {file?.file_name ?? "Arquivo"}
          </DialogTitle>
        </DialogHeader>

        {/* Preview area */}
        <div className="mt-2 rounded-2xl bg-muted/50 border border-border/40 overflow-hidden min-h-[300px] flex items-center justify-center">
          {loading ? (
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          ) : isImage && signedUrl ? (
            <img src={signedUrl} alt={file?.file_name} className="max-w-full max-h-[60vh] object-contain" />
          ) : isPdf && signedUrl ? (
            <iframe src={signedUrl} className="w-full h-[60vh]" title={file?.file_name} />
          ) : (
            <div className="flex flex-col items-center gap-3 text-muted-foreground py-12">
              <FileText className="h-12 w-12" />
              <p className="text-sm">Pré-visualização não disponível para este tipo de arquivo</p>
              <p className="text-xs">{file?.content_type} · {file ? formatSize(file.file_size) : ""}</p>
            </div>
          )}
        </div>

        {/* File info */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
          <span>{file ? formatSize(file.file_size) : ""}</span>
          <span className={`px-2 py-0.5 rounded-full font-medium ${
            file?.status === "approved"
              ? "bg-success/10 text-success"
              : file?.status === "rejected"
                ? "bg-destructive/10 text-destructive"
                : "bg-accent text-accent-foreground"
          }`}>
            {file?.status === "approved" ? "Aprovado ✅" : file?.status === "rejected" ? "Rejeitado ❌" : "Pendente ⏳"}
          </span>
        </div>

        {/* Rejection reason display */}
        {file?.status === "rejected" && file?.rejection_reason && (
          <div className="rounded-xl bg-destructive/5 border border-destructive/20 p-3 text-sm text-destructive">
            <strong>Motivo:</strong> {file.rejection_reason}
          </div>
        )}

        {/* Rejection form */}
        {showRejectForm && (
          <div className="space-y-2">
            <Label className="text-sm">Motivo da rejeição ❌</Label>
            <Textarea
              placeholder="Ex: Documento ilegível, faltando assinatura..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              className="rounded-xl resize-none"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="destructive"
                className="rounded-xl flex-1"
                onClick={handleReject}
                disabled={updating || !rejectionReason.trim()}
              >
                {updating ? "Rejeitando..." : "Confirmar Rejeição ❌"}
              </Button>
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => { setShowRejectForm(false); setRejectionReason(""); }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!showRejectForm && (
          <div className="flex gap-2 mt-3">
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={handleApprove}
              disabled={updating || file?.status === "approved"}
            >
              <CheckCircle2 className="mr-2 h-4 w-4 text-success" /> Aprovar
            </Button>
            <Button
              variant="outline"
              className="flex-1 rounded-xl"
              onClick={() => setShowRejectForm(true)}
              disabled={updating}
            >
              <XCircle className="mr-2 h-4 w-4 text-destructive" /> Rejeitar
            </Button>
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={handleDownload}
              disabled={!signedUrl}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewModal;
