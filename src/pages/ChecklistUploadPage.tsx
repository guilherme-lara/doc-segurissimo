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
 *    - UPDATE restrito ao owner. A marcação de is_completed é feita por
 *      trigger SECURITY DEFINER (mark_item_completed_on_upload) que dispara
 *      automaticamente após INSERT na tabela uploads.
 *
 * 4. Tabela public.user_plans:
 *    - SELECT público para verificar marca d'água (watermark)
 *
 * Para migração futura (jotatechinfo.com.br), replicar essas policies
 * no PostgreSQL nativo. O MinIO/storage local precisa de middleware
 * equivalente para autorizar uploads anônimos.
 */

import { useState, useCallback } from "react";
import { Shield, Upload, CheckCircle2, AlertTriangle } from "lucide-react";
import { useParams } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion } from "framer-motion";

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

  // Fetch plan for watermark check
  const { data: plan } = useQuery({
    queryKey: ["plan-watermark", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_plans")
        .select("show_watermark, max_file_size_mb")
        .eq("company_id", company!.id)
        .single();
      if (error) return { show_watermark: true, max_file_size_mb: 50 };
      return data;
    },
    enabled: !!company?.id,
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

    // Check file size limit
    const maxMb = plan?.max_file_size_mb ?? 50;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Arquivo muito grande`, { description: `Limite de ${maxMb}MB por arquivo.` });
      return;
    }

    setUploadingItemId(itemId);
    setUploadProgress(10);

    try {
      const timestamp = Date.now();
      const filePath = `${company.id}/${request.id}/${itemId}/${timestamp}_${file.name}`;

      setUploadProgress(30);

      // 1. Upload to storage (RLS: uploads_storage_public_insert)
      const { error: storageError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, { upsert: false });

      if (storageError) {
        console.error("Storage upload error:", storageError);
        throw new Error(`Falha no envio: ${storageError.message}`);
      }

      setUploadProgress(60);

      // 2. Insert upload record (RLS: uploads_public_insert WITH CHECK true)
      // Trigger mark_item_completed_on_upload auto-sets is_completed=true
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
        throw new Error(`Falha ao registrar: ${dbError.message}`);
      }

      setUploadProgress(100);
      toast.success(`"${file.name}" enviado! ✅`);

      setTimeout(() => {
        setUploadingItemId(null);
        setUploadProgress(0);
        refetchItems();
      }, 600);
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error("Erro no upload 😔", { description: err.message });
      setUploadingItemId(null);
      setUploadProgress(0);
    }
  };

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
  }, [company, request, plan]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
        <div className="w-full max-w-lg space-y-6">
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-12 w-12 rounded-2xl" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  // Invalid link
  if (!requestId || !request) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 text-center max-w-sm"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Link inválido 😕</h2>
          <p className="text-muted-foreground">
            Solicite o link correto ao seu profissional para acessar esta página.
          </p>
        </motion.div>
      </div>
    );
  }

  // All completed
  if (totalCount > 0 && completedCount === totalCount) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 text-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-success/10 animate-float">
            <CheckCircle2 className="h-10 w-10 text-success" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground">Tudo enviado! 🎉</h2>
            <p className="mt-2 text-muted-foreground">
              Obrigado, <strong>{request?.client_name}</strong>. {company?.display_name} já recebeu todos os documentos.
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col items-center gap-3 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-hero">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {company?.display_name ?? "Carregando..."}
            </h1>
            {request && (
              <p className="mt-1 text-sm text-muted-foreground">
                Documentos para <strong>{request.client_name}</strong>
              </p>
            )}
          </div>
        </motion.div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium text-foreground">
                {completedCount} de {totalCount} ✅
              </span>
            </div>
            <Progress value={(completedCount / totalCount) * 100} className="h-2 rounded-full" />
          </div>
        )}

        {/* Checklist by stage */}
        {Object.entries(stages).map(([stageName, stageItems]) => (
          <div key={stageName} className="mb-6">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {stageName}
            </h3>
            <div className="space-y-2">
              {stageItems.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onDragOver={(e) => !item.is_completed && handleDragOver(e, item.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => !item.is_completed && handleDrop(e, item.id)}
                  className={`flex items-center gap-3 rounded-2xl border p-4 transition-all duration-200 ${
                    item.is_completed
                      ? "border-success/30 bg-success/5"
                      : dragOverItemId === item.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 scale-[1.01]"
                        : "border-border/60 bg-card shadow-card hover:shadow-elevated"
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
                          <Progress value={uploadProgress} className="h-1.5 rounded-full" />
                        </div>
                      ) : (
                        <label className="cursor-pointer">
                          <span className="inline-flex items-center gap-1.5 rounded-xl gradient-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:shadow-glow transition-all duration-200">
                            <Upload className="h-3 w-3" />
                            Enviar
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(item.id, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        ))}

        {/* Watermark for free plans */}
        {plan?.show_watermark && (
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground/60">
              Feito via <span className="font-medium">Portal Seguríssimo</span> ✨
            </p>
          </div>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>Transferência protegida com criptografia 🔒</span>
        </div>
      </div>
    </div>
  );
};

export default ChecklistUploadPage;
