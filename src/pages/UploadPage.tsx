import { useState, useCallback } from "react";
import { Shield, Upload, CheckCircle2, FileUp, X } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const UploadPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [files, setFiles] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadState, setUploadState] = useState<"idle" | "uploading" | "success">("idle");

  // Mock company data — will be fetched from DB via slug
  const companyName = slug
    ? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : "Empresa";

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...droppedFiles]);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  }, []);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const simulateUpload = () => {
    setUploadState("uploading");
    setUploadProgress(0);
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15 + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(interval);
        setTimeout(() => setUploadState("success"), 300);
      }
      setUploadProgress(Math.min(progress, 100));
    }, 200);
  };

  if (uploadState === "success") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10 animate-in zoom-in duration-300">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Arquivo enviado com sucesso!</h2>
            <p className="mt-2 text-muted-foreground">
              Seus documentos foram recebidos por <strong>{companyName}</strong> de forma segura.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              setUploadState("idle");
              setFiles([]);
              setUploadProgress(0);
            }}
          >
            Enviar outro arquivo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">{companyName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Envie seus documentos de forma segura
            </p>
          </div>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 transition-all duration-200 ${
            isDragging
              ? "border-primary bg-primary/5 scale-[1.01]"
              : "border-border bg-card hover:border-primary/40"
          }`}
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted mb-4">
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            Arraste e solte seus arquivos aqui
          </p>
          <p className="mt-1 text-xs text-muted-foreground">ou</p>
          <label className="mt-3 cursor-pointer">
            <span className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              Selecionar arquivos
            </span>
            <input
              type="file"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
          </label>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card"
              >
                <FileUp className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-card-foreground">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
                </div>
                <button
                  onClick={() => removeFile(index)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}

            {uploadState === "uploading" && (
              <div className="mt-4 space-y-2">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-center text-xs text-muted-foreground">
                  Enviando... {Math.round(uploadProgress)}%
                </p>
              </div>
            )}

            <Button
              className="mt-4 w-full"
              size="lg"
              onClick={simulateUpload}
              disabled={uploadState === "uploading"}
            >
              {uploadState === "uploading" ? "Enviando..." : "Enviar arquivos"}
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>Transferência protegida com criptografia</span>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
