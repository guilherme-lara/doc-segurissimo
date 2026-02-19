import { useState, useCallback } from "react";
import { Shield, Upload, CheckCircle2, FileUp, X, AlertTriangle } from "lucide-react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

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

  // Fetch company by slug
  const { data: company } = useQuery({
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
  const { data: request } = useQuery({
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
  const { data: items, refetch: refetchItems } = useQuery({
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
    setUploadProgress(0);

    try {
      const filePath = `${company.id}/${request.id}/${itemId}/${file.name}`;

      // Simulate progress (real progress requires XMLHttpRequest)
      const progressInterval = setInterval(() => {
        setUploadProgress((p) => Math.min(p + 20, 90));
      }, 200);

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file);

      clearInterval(progressInterval);

      if (uploadError) throw uploadError;

      // Insert upload record
      const { error: insertError } = await supabase.from("uploads").insert({
        request_item_id: itemId,
        company_id: company.id,
        file_name: file.name,
        file_size: file.size,
        file_path: filePath,
        content_type: file.type,
      });
      if (insertError) throw insertError;

      // Mark item as completed
      await supabase
        .from("request_items")
        .update({ is_completed: true })
        .eq("id", itemId);

      setUploadProgress(100);
      setTimeout(() => {
        setUploadingItemId(null);
        setUploadProgress(0);
        refetchItems();
      }, 500);
    } catch (err) {
      console.error("Upload error:", err);
      setUploadingItemId(null);
      setUploadProgress(0);
    }
  };

  // Invalid link
  if (!requestId || (!request && requestId)) {
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
                  className={`flex items-center gap-3 rounded-xl border p-4 transition-all ${
                    item.is_completed
                      ? "border-success/30 bg-success/5"
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
