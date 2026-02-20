/**
 * ChecklistUploadPage — Página pública de upload do cliente
 *
 * REGRAS DE RLS (Row Level Security) para upload público:
 * ─────────────────────────────────────────────────────────
 * O cliente final acessa esta página via link único (sem autenticação).
 *
 * 1. Storage bucket "uploads":
 *    - INSERT público: qualquer pessoa pode fazer upload de arquivos
 *      Policy: uploads_storage_public_insert → WITH CHECK (bucket_id = 'uploads')
 *    - SELECT/DELETE restrito ao owner da company (auth.uid())
 *
 * 2. Tabela public.uploads:
 *    - INSERT público (uploads_public_insert) → WITH CHECK (true)
 *      Justificativa: o cliente não está autenticado; validação é feita
 *      pelo fato de que ele precisa de um request_item_id válido.
 *    - SELECT/DELETE restrito ao owner da company
 *
 * 3. Tabela public.request_items:
 *    - SELECT público (request_items_public_read) → USING (true)
 *    - UPDATE restrito ao owner (não permitimos que o cliente marque
 *      is_completed; isso é feito em server-side ou pelo owner)
 *
 * Para migração futura (jotatechinfo.com.br), replicar essas policies
 * no PostgreSQL nativo. O MinIO/storage local precisa de middleware
 * equivalente para autorizar uploads anônimos.
 */

import { useState, useCallback, useRef } from "react";
import { Shield, Upload, CheckCircle2, AlertTriangle, FileUp } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface RequestItem {
  id: string;
  item_name: string;
  stage_name: string;
  is_completed: boolean;
  sort_order: number;
}

interface DocumentRequest {
  id: string;
  client_name: string;
  company_id: string;
}

const ChecklistUploadPage = () => {
  const { slug, requestId } = useParams<{ slug: string; requestId: string }>();
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  // Fetch company by slug
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["company", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, display_name, slug, logo_url")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch document request
  const { data: request, isLoading: requestLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requests")
        .select("id, client_name, company_id")
        .eq("id", requestId)
        .single();
      if (error) throw error;
      return data as DocumentRequest;
    },
    enabled: !!requestId,
  });

  // Fetch checklist items
  const { data: items, isLoading: itemsLoading, refetch: refetchItems } = useQuery({
    queryKey: ["request-items", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("request_items")
        .select("id, item_name, stage_name, is_completed, sort_order")
        .eq("request_id", requestId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as RequestItem[];
    },
    enabled: !!requestId,
  });

  const isLoading = companyLoading || requestLoading || itemsLoading;
  const completedCount = items?.filter((i) => i.is_completed).length ?? 0;
  const totalCount = items?.length ?? 0;

  // Group items by stage
  const stages = items?.reduce<Record<string, RequestItem[]>>((acc, item) => {
    if (!acc[item.stage_name]) acc[item.stage_name] = [];
    acc[item.stage_name].push(item);
    return acc;
  }, {}) ?? {};

  const handleFileUpload = async (itemId: string, file: File) => {
    if (!company || !request) return;
    setUploadingItemId(itemId);
    setUploadProgress(10);

    try {
      // Unique file path to prevent collisions
      const timestamp = Date.now();
      const filePath = `${company.id}/${request.id}/${itemId}/${timestamp}_${file.name}`;

      setUploadProgress(30);

      // 1. Upload file to storage bucket
      // RLS: uploads_storage_public_insert allows anonymous INSERT on bucket_id='uploads'
      const { error: storageError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, { upsert: false });

      if (storageError) {
        console.error("Storage upload error:", storageError);
        throw new Error(`Falha no envio do arquivo: ${storageError.message}`);
      }

      setUploadProgress(60);

      // 2. Insert upload record in database
      // RLS: uploads_public_insert allows anonymous INSERT (WITH CHECK true)
      const { error: dbError } = await supabase.from("uploads").insert({
        request_item_id: itemId,
        company_id: company.id,
        file_name: file.name,
        file_size: file.size,
        file_path: filePath,
        content_type: file.type || "application/octet-stream",
      });

      if (dbError) {
        console.error("DB insert error:", dbError);
        throw new Error(`Falha ao registrar arquivo: ${dbError.message}`);
      }

      setUploadProgress(100);
      toast.success(`"${file.name}" enviado com sucesso!`);

      // Refetch to show updated completion status
      setTimeout(() => {
        setUploadingItemId(null);
        setUploadProgress(0);
        refetchItems();
      }, 600);
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Erro no upload", { description: err.message });
      setUploadingItemId(null);
      setUploadProgress(0);
    }
  };

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemId(itemId);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemId(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverItemId(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(itemId, file);
  }, [company, request]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
        <div className="w-full max-w-lg space-y-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-2 w-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // Invalid link
  if (!requestId || !request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Acesso negado</h2>
          <p className="text-muted-foreground">
            Solicite o link de envio ao seu profissional para acessar esta página.
          </p>
        </div>
      </div>
    );
  }

  // All completed
  if (totalCount > 0 && completedCount === totalCount) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Todos os documentos enviados!</h2>
            <p className="mt-2 text-muted-foreground">
              Obrigado, <strong>{request?.client_name}</strong>. {company?.display_name} já recebeu tudo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {company?.display_name ?? "Carregando..."}
            </h1>
            {request && (
              <p className="mt-1 text-sm text-muted-foreground">
                Documentos solicitados para <strong>{request.client_name}</strong>
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium text-foreground">
                {completedCount} de {totalCount} enviados
              </span>
            </div>
            <Progress value={(completedCount / totalCount) * 100} className="h-2" />
          </div>
        )}

        {/* Checklist by stage */}
        {Object.entries(stages).map(([stageName, stageItems]) => (
          <div key={stageName} className="mb-6">
            <h3 className="mb-3 text-sm font-semibold text-foreground uppercase tracking-wide">
              {stageName}
            </h3>
            <div className="space-y-2">
              {stageItems.map((item) => (
                <div
                  key={item.id}
                  onDragOver={(e) => !item.is_completed && handleDragOver(e, item.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => !item.is_completed && handleDrop(e, item.id)}
                  className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${
                    item.is_completed
                      ? "border-success/30 bg-success/5"
                      : dragOverItemId === item.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border bg-card shadow-card"
                  }`}
                >
                  {item.is_completed ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                  ) : (
                    <div className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />
                  )}

                  <span
                    className={`flex-1 text-sm font-medium ${
                      item.is_completed ? "text-success line-through" : "text-card-foreground"
                    }`}
                  >
                    {item.item_name}
                  </span>

                  {!item.is_completed && (
                    <>
                      {uploadingItemId === item.id ? (
                        <div className="w-24">
                          <Progress value={uploadProgress} className="h-1.5" />
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                            <Upload className="h-3 w-3" />
                            Enviar
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(item.id, file);
                              e.target.value = ""; // reset to allow re-upload
                            }}
                          />
                        </label>
                      )}
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>Transferência protegida com criptografia</span>
        </div>
      </div>
    </div>
  );
};

export default ChecklistUploadPage;
