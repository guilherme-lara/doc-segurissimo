/**
 * ChecklistUploadPage — Página pública de upload do cliente
 *
 * REGRAS DE RLS (Row Level Security) para upload público:
 * ─────────────────────────────────────────────────────────
 * O cliente final acessa esta página via link único (sem autenticação).
 *
 * 1. Storage bucket "uploads":
 *    - INSERT público: qualquer pessoa pode fazer upload de arquivos
 *    - SELECT/DELETE restrito ao owner da company (auth.uid())
 *
 * 2. Tabela public.uploads:
 *    - INSERT público (uploads_public_insert) → WITH CHECK (true)
 *    - SELECT/DELETE restrito ao owner da company
 *    - Trigger on_upload_audit_log cria entrada no audit_logs automaticamente
 *
 * 3. Tabela public.request_items:
 *    - SELECT público (request_items_public_read) → USING (true)
 *    - Trigger mark_item_completed_on_upload auto-marca is_completed
 *    - Trigger on_upload_rejected desmarca is_completed quando rejeitado
 *
 * 4. Tabela public.uploads:
 *    - rejection_reason TEXT: motivo da rejeição exibido ao cliente
 *    - status: 'pending' | 'approved' | 'rejected'
 *
 * 5. Tabela public.document_requests:
 *    - access_password TEXT (nullable): senha de acesso (PRO only)
 *
 * 6. White-label (PRO):
 *    - companies.logo_url, companies.primary_color, companies.cnpj, companies.phone
 *    - user_plans.show_watermark controla exibição da marca d'água
 */

import { useState, useCallback, useEffect, useMemo } from "react";
import { Shield, Upload, CheckCircle2, AlertTriangle, Lock, PartyPopper, Clock, Type, Loader2 } from "lucide-react";
import { useParams } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import FilePreviewThumbnail from "@/components/checklist/FilePreviewThumbnail";
import { validateAndProcessFile } from "@/lib/file-security";

interface RequestItem {
  id: string;
  item_name: string;
  stage_name: string;
  is_completed: boolean;
  sort_order: number;
  item_type: string;
  text_answer: string | null;
}

interface UploadRecord {
  id: string;
  request_item_id: string;
  status: string;
  rejection_reason: string | null;
  file_name: string;
}

interface DocumentRequest {
  id: string;
  client_name: string;
  company_id: string;
  access_password: string | null;
  expires_at: string | null;
}

const ChecklistUploadPage = () => {
  const { slug, requestId } = useParams<{ slug: string; requestId: string }>();
  const queryClient = useQueryClient();
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [stagedFiles, setStagedFiles] = useState<Record<string, File>>({});
  const [lgpdAccepted, setLgpdAccepted] = useState(false);

  // Password protection state
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordVerified, setPasswordVerified] = useState(false);

  // Global drag prevention
  useEffect(() => {
    const preventDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener("dragover", preventDrop);
    window.addEventListener("drop", preventDrop);
    return () => {
      window.removeEventListener("dragover", preventDrop);
      window.removeEventListener("drop", preventDrop);
    };
  }, []);

  // Fetch company
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["company", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, display_name, slug, logo_url, primary_color, cnpj, phone")
        .eq("slug", slug)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  // Fetch plan
  const { data: plan } = useQuery({
    queryKey: ["plan-watermark", company?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_plans")
        .select("show_watermark, max_file_size_mb, plan")
        .eq("company_id", company!.id)
        .single();
      if (error) return { show_watermark: true, max_file_size_mb: 50, plan: "free" as const };
      return data;
    },
    enabled: !!company?.id,
  });

  const isPro = plan?.plan === "pro";

  // Fetch document request (includes access_password)
  const { data: request, isLoading: requestLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_requests")
        .select("id, client_name, company_id, access_password, expires_at")
        .eq("id", requestId)
        .single();
      if (error) throw error;
      console.log("[checklist] Request loaded:", { id: data.id, expires_at: data.expires_at, hasPassword: !!data.access_password });
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
        .select("id, item_name, stage_name, is_completed, sort_order, item_type, text_answer")
        .eq("request_id", requestId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      console.log("[checklist] Items loaded:", data?.length, "items");
      return data as RequestItem[];
    },
    enabled: !!requestId,
  });

  // Fetch uploads filtered by this request's item IDs
  const itemIds = useMemo(() => items?.map((i) => i.id) ?? [], [items]);

  const { data: uploads, refetch: refetchUploads } = useQuery({
    queryKey: ["client-uploads", requestId, itemIds],
    queryFn: async () => {
      if (itemIds.length === 0) return [] as UploadRecord[];
      const { data, error } = await supabase
        .from("uploads")
        .select("id, request_item_id, status, rejection_reason, file_name")
        .in("request_item_id", itemIds)
        .order("created_at", { ascending: false });
      if (error) return [] as UploadRecord[];
      return (data ?? []) as UploadRecord[];
    },
    enabled: itemIds.length > 0,
  });
  // Realtime: listen for changes on request_items and uploads
  useEffect(() => {
    if (!requestId || !items || items.length === 0) return;

    const channel = supabase
      .channel(`checklist-${requestId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "request_items", filter: `request_id=eq.${requestId}` },
        () => { refetchItems(); }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "uploads" },
        (payload) => {
          const itemId = (payload.new as any)?.request_item_id ?? (payload.old as any)?.request_item_id;
          if (itemId && items.some((i) => i.id === itemId)) {
            refetchUploads();
            refetchItems();
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [requestId, items?.length]);


  const uploadsByItem = useMemo(() => {
    const map: Record<string, UploadRecord> = {};
    if (!uploads) return map;
    // latest first, so first match per item wins
    for (const u of uploads) {
      if (!map[u.request_item_id]) {
        map[u.request_item_id] = u;
      }
    }
    return map;
  }, [uploads]);

  const isLoading = companyLoading || requestLoading || itemsLoading;
  const totalCount = items?.length ?? 0;

  // Check all items approved (not just completed — must be approved)
  const allApproved = useMemo(() => {
    if (!items || items.length === 0) return false;
    return items.every((item) => {
      const upload = uploadsByItem[item.id];
      return upload?.status === "approved";
    });
  }, [items, uploadsByItem]);

  const completedCount = items?.filter((i) => i.is_completed).length ?? 0;

  // Group items by stage
  const stages = items?.reduce<Record<string, RequestItem[]>>((acc, item) => {
    if (!acc[item.stage_name]) acc[item.stage_name] = [];
    acc[item.stage_name].push(item);
    return acc;
  }, {}) ?? {};

  const [processingItemId, setProcessingItemId] = useState<string | null>(null);

  const stageFile = async (itemId: string, file: File) => {
    const maxMb = plan?.max_file_size_mb ?? 50;
    if (file.size > maxMb * 1024 * 1024) {
      toast.error(`Arquivo muito grande`, { description: `Limite de ${maxMb}MB por arquivo.` });
      return;
    }

    // Zero Trust: validação + compressão
    setProcessingItemId(itemId);
    try {
      const result = await validateAndProcessFile(file);
      if (!result.valid) {
        toast.error("Arquivo bloqueado 🚫", { description: result.error, duration: 6000 });
        return;
      }
      const processed = result.processedFile!;
      if (processed.size < file.size) {
        const saved = ((1 - processed.size / file.size) * 100).toFixed(0);
        toast.success(`Imagem otimizada! 📸`, { description: `Redução de ${saved}% no tamanho.` });
      }
      setStagedFiles((prev) => ({ ...prev, [itemId]: processed }));
    } catch (err) {
      toast.error("Erro ao processar arquivo");
    } finally {
      setProcessingItemId(null);
    }
  };

  const removeStagedFile = (itemId: string) => {
    setStagedFiles((prev) => {
      const next = { ...prev };
      delete next[itemId];
      return next;
    });
  };

  const confirmUpload = async (itemId: string) => {
    const file = stagedFiles[itemId];
    if (!file || !company || !request) return;
    if (!lgpdAccepted) {
      toast.warning("Aceite os termos LGPD antes de enviar.");
      return;
    }

    setUploadingItemId(itemId);
    setUploadProgress(10);

    try {
      const timestamp = Date.now();
      const filePath = `${company.id}/${request.id}/${itemId}/${timestamp}_${file.name}`;
      setUploadProgress(30);

      const { error: storageError } = await supabase.storage
        .from("uploads")
        .upload(filePath, file, { upsert: false });

      if (storageError) throw new Error(`Falha no envio: ${storageError.message}`);
      setUploadProgress(60);

      const { error: dbError } = await supabase.from("uploads").insert({
        request_item_id: itemId,
        company_id: company.id,
        file_name: file.name,
        file_size: file.size,
        file_path: filePath,
        content_type: file.type || "application/octet-stream",
        lgpd_consent: true,
      } as any);

      if (dbError) throw new Error(`Falha ao registrar: ${dbError.message}`);
      setUploadProgress(100);
      toast.success(`"${file.name}" enviado! ✅`);

      setTimeout(() => {
        setUploadingItemId(null);
        setUploadProgress(0);
        removeStagedFile(itemId);
        refetchItems();
        refetchUploads();
      }, 600);
    } catch (err: any) {
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
    if (file) stageFile(itemId, file);
  }, [plan]);

  const brandColor = isPro ? company?.primary_color : undefined;

  // Password gate
  const needsPassword = !!request?.access_password && !passwordVerified;

  const verifyPassword = () => {
    if (passwordInput === request?.access_password) {
      setPasswordVerified(true);
    } else {
      toast.error("Senha incorreta 🔒");
    }
  };

  // Link expiration + countdown (hooks must be before early returns)
  const isExpired = request?.expires_at ? new Date(request.expires_at) < new Date() : false;
  
  const [countdown, setCountdown] = useState("");
  useEffect(() => {
    if (!request?.expires_at || isExpired) return;
    const update = () => {
      const diff = new Date(request.expires_at!).getTime() - Date.now();
      if (diff <= 0) { setCountdown("Expirado"); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${d > 0 ? d + "d " : ""}${h}h ${m}m ${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [request?.expires_at, isExpired]);

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

  if (isExpired) {
    console.log("[checklist] Link expired:", request.expires_at);
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 text-center max-w-sm"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-destructive/10">
            <Clock className="h-8 w-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Link Expirado ⏰</h2>
          <p className="text-muted-foreground">
            Este link de envio de documentos expirou. Solicite um novo link ao seu profissional.
          </p>
        </motion.div>
      </div>
    );
  }

  // Password protection screen
  if (needsPassword) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-6 text-center max-w-sm w-full"
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-3xl shadow-hero"
            style={brandColor ? { background: brandColor } : undefined}
          >
            {!brandColor && <div className="absolute inset-0 rounded-3xl gradient-primary" />}
            <Lock className="h-8 w-8 text-primary-foreground relative z-10" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Acesso Protegido 🔒</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Digite a senha fornecida pelo profissional para acessar seus documentos.
            </p>
          </div>
          <div className="w-full space-y-3">
            <Input
              type="password"
              placeholder="Digite a senha..."
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifyPassword()}
              className="rounded-xl text-center"
            />
            <Button
              onClick={verifyPassword}
              className="w-full rounded-xl gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300"
              style={brandColor ? { background: brandColor } : undefined}
            >
              Acessar Documentos 🔓
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // All approved → Success screen with confetti
  if (allApproved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", duration: 0.8 }}
          className="flex flex-col items-center gap-6 text-center max-w-md"
        >
          <motion.div
            initial={{ rotate: -10, scale: 0 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", delay: 0.2, stiffness: 200 }}
            className="flex h-24 w-24 items-center justify-center rounded-3xl bg-success/10"
          >
            <PartyPopper className="h-12 w-12 text-success" />
          </motion.div>
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-3xl font-bold text-foreground"
            >
              Parabéns! 🎉
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="mt-3 text-muted-foreground leading-relaxed"
            >
              Todos os seus documentos foram <strong className="text-success">aprovados</strong> e o processo está em andamento.
            </motion.p>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-2 text-sm text-muted-foreground rounded-2xl bg-success/5 border border-success/20 px-5 py-3"
          >
            <CheckCircle2 className="h-5 w-5 text-success" />
            <span>{totalCount} documento{totalCount !== 1 ? "s" : ""} aprovado{totalCount !== 1 ? "s" : ""}</span>
          </motion.div>
          {isPro && company?.display_name && (
            <p className="text-xs text-muted-foreground mt-4">
              {company.display_name}
              {company.cnpj && ` · CNPJ: ${company.cnpj}`}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  // Helper: get item status from uploads
  const getItemStatus = (itemId: string) => {
    const upload = uploadsByItem[itemId];
    if (!upload) return "waiting"; // never uploaded
    return upload.status; // pending, approved, rejected
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col items-center gap-3 text-center"
        >
          {isPro && company?.logo_url ? (
            <img src={company.logo_url} alt={company.display_name} className="h-12 w-12 rounded-2xl object-cover shadow-hero" />
          ) : (
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl shadow-hero ${!brandColor ? 'gradient-primary' : ''}`}
              style={brandColor ? { background: brandColor } : undefined}
            >
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
          )}
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

        {/* Countdown timer for expiring links */}
        {request?.expires_at && !isExpired && countdown && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-2xl border border-pro/30 bg-pro/5 px-4 py-2.5 text-sm">
            <Clock className="h-4 w-4 text-pro" />
            <span className="text-muted-foreground">Expira em:</span>
            <span className="font-mono font-semibold text-pro">{countdown}</span>
          </div>
        )}

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mb-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso</span>
              <span className="font-medium text-foreground">
                {completedCount} de {totalCount} ✅
              </span>
            </div>
            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${!brandColor ? 'gradient-primary' : ''}`}
                style={{
                  width: `${(completedCount / totalCount) * 100}%`,
                  ...(brandColor ? { backgroundColor: brandColor } : {}),
                }}
              />
            </div>
          </div>
        )}

        {/* Checklist by stage */}
        {Object.entries(stages).map(([stageName, stageItems]) => (
          <div key={stageName} className="mb-6">
            <h3 className="mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {stageName}
            </h3>
            <div className="space-y-2">
              {stageItems.map((item, i) => {
                const staged = stagedFiles[item.id];
                const isUploading = uploadingItemId === item.id;
                const itemStatus = getItemStatus(item.id);
                const isRejected = itemStatus === "rejected";
                const rejectionReason = uploadsByItem[item.id]?.rejection_reason;
                const isApproved = itemStatus === "approved";
                const isTextItem = item.item_type === "text";
                const canUpload = !isTextItem && (!item.is_completed || isRejected);

                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <div
                      onDragOver={(e) => canUpload && handleDragOver(e, item.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => canUpload && handleDrop(e, item.id)}
                      className={`flex items-center gap-3 rounded-2xl border p-4 transition-all duration-200 ${
                        isApproved
                          ? "border-success/30 bg-success/5"
                          : isRejected
                            ? "border-destructive/30 bg-destructive/5"
                            : item.is_completed
                              ? "border-success/30 bg-success/5"
                              : dragOverItemId === item.id
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20 scale-[1.01]"
                                : "border-border/60 bg-card shadow-card hover:shadow-elevated"
                      }`}
                    >
                      {isApproved ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                      ) : isRejected ? (
                        <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                      ) : item.is_completed ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
                      ) : (
                        <div className="h-5 w-5 shrink-0 rounded-full border-2 border-border" />
                      )}

                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-sm font-medium ${
                            isApproved ? "text-success line-through" :
                            isRejected ? "text-destructive" :
                            item.is_completed ? "text-success" :
                            "text-card-foreground"
                          }`}
                        >
                          {item.item_name}
                        </span>
                        {isRejected && rejectionReason && (
                          <p className="text-xs text-destructive/80 mt-1">
                            ❌ {rejectionReason}
                          </p>
                        )}
                      </div>

                      {/* Text input for text-type items */}
                      {isTextItem && !item.is_completed && (
                        <div className="flex gap-2 shrink-0 w-full max-w-[200px]">
                          <Textarea
                            placeholder="Digite sua resposta..."
                            className="rounded-xl text-xs min-h-[36px] h-9"
                            defaultValue={item.text_answer ?? ""}
                            onBlur={async (e) => {
                              const answer = e.target.value.trim();
                              if (!answer) return;
                              console.log("[checklist] Saving text answer for item:", item.id);
                              const { error } = await supabase
                                .from("request_items")
                                .update({ text_answer: answer, is_completed: true })
                                .eq("id", item.id);
                              if (error) { toast.error("Erro ao salvar resposta"); return; }
                              toast.success("Resposta salva! ✅");
                              refetchItems();
                            }}
                          />
                        </div>
                      )}
                      {isTextItem && item.is_completed && item.text_answer && (
                        <span className="text-xs text-success shrink-0">✅ Respondido</span>
                      )}

                      {canUpload && !staged && !isUploading && processingItemId !== item.id && (
                        <label className="cursor-pointer shrink-0">
                          <span
                            className="relative inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-primary-foreground hover:shadow-glow transition-all duration-200 overflow-hidden"
                            style={brandColor ? { background: brandColor } : undefined}
                          >
                            {!brandColor && <span className="absolute inset-0 rounded-xl gradient-primary -z-0" />}
                            <Upload className="h-3 w-3 relative z-10" />
                            <span className="relative z-10">{isRejected ? "Reenviar" : "Enviar"}</span>
                          </span>
                          <input
                            type="file"
                            className="hidden"
                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) stageFile(item.id, file);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                      {processingItemId === item.id && (
                        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
                          <Loader2 className="h-3 w-3 animate-spin" /> Processando...
                        </span>
                      )}
                    </div>

                    {/* File preview thumbnail */}
                    {staged && (
                      <FilePreviewThumbnail
                        file={staged}
                        onRemove={() => removeStagedFile(item.id)}
                        onConfirm={() => confirmUpload(item.id)}
                        isUploading={isUploading}
                        uploadProgress={uploadProgress}
                      />
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        ))}

        {/* LGPD Consent Checkbox */}
        <div className="mt-6 rounded-2xl border border-border/60 bg-card p-4 shadow-card">
          <div className="flex items-start gap-3">
            <Checkbox
              id="lgpd-consent"
              checked={lgpdAccepted}
              onCheckedChange={(checked) => setLgpdAccepted(!!checked)}
              className="mt-0.5"
            />
            <Label htmlFor="lgpd-consent" className="text-xs text-muted-foreground leading-relaxed cursor-pointer">
              Declaro que li e aceito os <span className="text-primary font-medium">Termos de Uso</span> e a{" "}
              <span className="text-primary font-medium">Política de Privacidade</span> (LGPD). 
              Confirmo que os documentos enviados são autênticos e autorizo seu tratamento.
            </Label>
          </div>
        </div>


        {plan?.show_watermark && (
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground/60">
              Feito via <span className="font-medium">Portal Seguríssimo</span> ✨
            </p>
          </div>
        )}

        {/* PRO: Company footer with branding */}
        {isPro && (company?.cnpj || company?.phone) && (
          <div className="mt-4 text-center space-y-0.5">
            {company.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {company.cnpj}</p>}
            {company.phone && <p className="text-xs text-muted-foreground">📞 {company.phone}</p>}
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
