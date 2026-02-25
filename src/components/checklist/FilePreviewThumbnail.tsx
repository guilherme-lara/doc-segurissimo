/**
 * FilePreviewThumbnail — Miniatura do arquivo selecionado antes do envio
 *
 * Exibe um preview usando URL.createObjectURL() para imagens e PDFs.
 * Inclui botão de lixeira para trocar o arquivo antes do upload.
 * Limpa ObjectURLs automaticamente para evitar vazamento de memória.
 */
import { useEffect, useState } from "react";
import { Trash2, FileText, Image as ImageIcon } from "lucide-react";

interface FilePreviewThumbnailProps {
  file: File;
  onRemove: () => void;
  onConfirm: () => void;
  isUploading: boolean;
  uploadProgress: number;
}

const FilePreviewThumbnail = ({ file, onRemove, onConfirm, isUploading, uploadProgress }: FilePreviewThumbnailProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const isImage = file.type.startsWith("image/");
  const isPdf = file.type === "application/pdf";

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="mt-2 rounded-2xl border border-border/60 bg-card p-3 shadow-card animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
      <div className="flex items-center gap-3">
        {/* Thumbnail */}
        <div className="relative h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-muted flex items-center justify-center">
          {isImage && previewUrl ? (
            <img src={previewUrl} alt="Preview" className="h-full w-full object-cover" />
          ) : isPdf && previewUrl ? (
            <FileText className="h-6 w-6 text-destructive" />
          ) : (
            <FileText className="h-6 w-6 text-muted-foreground" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-card-foreground truncate">{file.name}</p>
          <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
          {isUploading && (
            <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full gradient-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          )}
        </div>

        {/* Actions */}
        {!isUploading && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onRemove}
              className="rounded-xl p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
              title="Trocar arquivo"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <button
              onClick={onConfirm}
              className="inline-flex items-center gap-1.5 rounded-xl gradient-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:shadow-glow transition-all duration-200"
            >
              Enviar ✨
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FilePreviewThumbnail;
