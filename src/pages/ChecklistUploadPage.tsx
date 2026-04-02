import { useState, useCallback, useEffect, useMemo } from "react";
import { Shield, Upload, CheckCircle2, AlertTriangle, Lock, PartyPopper, Clock, Type, Loader2, ArrowRight } from "lucide-react";
import { useParams, Link } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import FilePreviewThumbnail from "@/components/checklist/FilePreviewThumbnail";
import { validateAndProcessFile, checkBlockedExtension } from "@/lib/file-security";

// Tipagem básica para não dar erro
interface RequestItem {
  id: string;
  stage_name: string;
  item_name: string;
  is_completed: boolean;
}

const ChecklistUploadPage = () => {
  const { slug, requestId } = useParams<{ slug: string; requestId: string }>();
  const queryClient = useQueryClient();
  
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stagedFiles, setStagedFiles] = useState<Record<string, File>>({});
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [isAccepting, setIsAccepting] = useState(false);
  const [clientIp, setClientIp] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordVerified, setPasswordVerified] = useState(false);

  // Busca IP para Auditoria
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json()).then(data => setClientIp(data.ip))
      .catch(() => setClientIp("IP_NAO_CAPTURADO"));
  }, []);

  // 1. Queries de Dados
  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ["company", slug],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").eq("slug", slug).single();
      if (error) throw error;
      return data;
    },
    enabled: !!slug,
  });

  const { data: request, isLoading: requestLoading, refetch: refetchRequest } = useQuery({
    queryKey: ["request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase.from("document_requests").select("*").eq("id", requestId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });

  const { data: items, isLoading: itemsLoading, refetch: refetchItems } = useQuery({
    queryKey: ["request-items", requestId],
    queryFn: async () => {
      const { data, error } = await supabase.from("request_items").select("*").eq("request_id", requestId).order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });

  const { data: uploads, refetch: refetchUploads } = useQuery({
    queryKey: ["client-uploads", requestId],
    queryFn: async () => {
      const { data } = await supabase.from("uploads").select("*").in("request_item_id", items?.map(i => i.id) || []);
      return data || [];
    },
    enabled: !!items?.length,
  });

  // 2. REAL-TIME
  useEffect(() => {
    if (!requestId) return;

    const channel = supabase.channel(`public-realtime-${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "uploads" }, () => {
        refetchUploads();
        refetchItems();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "request_items", filter: `request_id=eq.${requestId}` }, () => {
        refetchItems();
        refetchUploads();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "document_requests", filter: `id=eq.${requestId}` }, () => {
        refetchRequest();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [requestId, refetchItems, refetchUploads, refetchRequest]);

  // 3. Mapeamento de Status
  const uploadsByItem = useMemo(() => {
    const map: Record<string, any> = {};
    uploads?.forEach(u => { map[u.request_item_id] = u; });
    return map;
  }, [uploads]);

  const allApproved = useMemo(() => {
    if (!items || items.length === 0) return false;
    return items.every((item) => uploadsByItem[item.id]?.status === "approved");
  }, [items, uploadsByItem]);

  // --- CORREÇÃO DA FUNÇÃO DA LGPD AQUI ---
  const handleLGPDAcceptance = async () => {
    if (!request) return;
    setIsAccepting(true);
    try {
      const { error } = await supabase
        .from("document_requests")
        .update({ 
          lgpd_accepted_at: new Date().toISOString(),
          lgpd_accepted_ip: clientIp 
        })
        .eq("id", request.id);
      
      if (error) throw error;
      await refetchRequest();
      toast.success("Termos aceitos com sucesso! 🚀");
    } catch (err) {
      toast.error("Erro ao registrar aceite. Tente novamente.");
    } finally {
      setIsAccepting(false);
    }
  };

  // Processamento do Arquivo no Input
  const handleFileChange = async (itemId: string, file: File) => {
    // 1. Zero Trust: Blocklist
    const blockedMsg = checkBlockedExtension(file.name);
    if (blockedMsg) {
      toast.error("Formato não permitido 🚫", { description: blockedMsg });
      return;
    }

    // 2. Hard Limits
    const currentPlan = company?.plan ?? "free";
    const maxMb = currentPlan === "pro" ? 50 : 10;
    const fileSizeMb = file.size / (1024 * 1024);
    
    if (fileSizeMb > maxMb) {
      toast.error(`Arquivo muito grande (${fileSizeMb.toFixed(1)}MB)`, {
        description: `O limite é de ${maxMb}MB por arquivo.`,
      });
      return;
    }

    // 3. Validação e Processamento
    const res = await validateAndProcessFile(file);
    if (res.valid && res.processedFile) {
      setStagedFiles(prev => ({ ...prev, [itemId]: res.processedFile! }));
    }
  };

  const confirmUpload = async (itemId: string) => {
    const file = stagedFiles[itemId];
    if (!file || !company || !request) return;
    setUploadingItemId(itemId);
    setUploadProgress(20);
    try {
      const filePath = `${company.id}/${request.id}/${itemId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("uploads").upload(filePath, file);
      if (uploadError) throw uploadError;

      setUploadProgress(70);
      const { error: insertError } = await supabase.from("uploads").insert({
        request_item_id: itemId, 
        company_id: company.id, 
        file_name: file.name,
        file_size: file.size, 
        file_path: filePath, 
        content_type: file.type || "application/octet-stream",
        lgpd_consent: true, 
        uploader_ip: clientIp 
      } as any);

      if (insertError) throw insertError;

      setUploadProgress(100);
      toast.success("Documento enviado com sucesso! ✅");
      
      // Limpa o arquivo da tela
      setStagedFiles(prev => { const n = {...prev}; delete n[itemId]; return n; });
    } catch (err) { 
      toast.error("Erro no upload", { description: "Tente novamente ou verifique sua conexão." }); 
    } finally {
      setUploadingItemId(null);
      setUploadProgress(0);
    }
  };

  const needsPassword = !!request?.access_password && !passwordVerified;
  const hasAcceptedLGPD = !!request?.lgpd_accepted_at;

  if (companyLoading || requestLoading || itemsLoading) return <div className="p-20 text-center"><Loader2 className="animate-spin mx-auto h-10 w-10 text-primary" /></div>;

  // TELA DE SENHA
  if (needsPassword) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full max-w-sm text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-3xl gradient-primary flex items-center justify-center shadow-hero"><Lock className="text-white" /></div>
        <h2 className="text-xl font-bold">Acesso Protegido</h2>
        <Input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="Digite a senha" className="rounded-xl text-center h-12" />
        <Button onClick={() => passwordInput === request.access_password ? setPasswordVerified(true) : toast.error("Senha incorreta")} className="w-full rounded-xl h-12 gradient-primary shadow-hero">Entrar</Button>
      </motion.div>
    </div>
  );

  // TELA LGPD GATE
  if (!hasAcceptedLGPD && !allApproved) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border/60 rounded-[2.5rem] p-8 shadow-card text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-[2rem] gradient-primary flex items-center justify-center shadow-hero">
          {company?.logo_url ? <img src={company.logo_url} className="w-full h-full object-cover rounded-[2rem]" /> : <Shield className="w-10 h-10 text-white" />}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{company?.display_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Checklist de Documentos para <b>{request?.client_name}</b></p>
        </div>
        <div className="bg-accent/30 p-5 rounded-3xl border border-border/40 text-left">
          <div className="flex gap-3">
            <Checkbox id="lgpd" checked={lgpdAccepted} onCheckedChange={checked => setLgpdAccepted(!!checked)} className="mt-1" />
            <Label htmlFor="lgpd" className="text-xs leading-relaxed text-muted-foreground cursor-pointer">
              Declaro que li e aceito os <Link to="/termos" target="_blank" className="text-primary font-bold hover:underline">Termos de Uso</Link> e a <Link to="/privacidade" target="_blank" className="text-primary font-bold hover:underline">Política de Privacidade</Link> (LGPD).
              Autorizo o tratamento dos meus dados para este processo.
            </Label>
          </div>
        </div>
        <Button disabled={!lgpdAccepted || isAccepting} onClick={handleLGPDAcceptance} className="w-full h-14 rounded-2xl text-lg font-bold gradient-primary shadow-hero">
          {isAccepting ? <Loader2 className="animate-spin mr-2" /> : "Acessar Checklist"} <ArrowRight className="ml-2" />
        </Button>
      </motion.div>
    </div>
  );

  // TELA DE SUCESSO
  if (allApproved) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
        <div className="mx-auto w-24 h-24 rounded-[2rem] bg-success/10 flex items-center justify-center"><PartyPopper className="w-12 h-12 text-success" /></div>
        <h2 className="text-3xl font-extrabold">Parabéns! 🎉</h2>
        <p className="text-muted-foreground max-w-xs mx-auto">Seus documentos foram conferidos e aprovados por <b>{company?.display_name}</b>.</p>
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-success/10 text-success border border-success/20 font-bold">
          <CheckCircle2 className="w-5 h-5" /> Processo Concluído
        </div>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center gap-4 bg-card border border-border/60 p-4 rounded-3xl shadow-sm">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shrink-0">
             {company?.logo_url ? <img src={company.logo_url} className="w-full h-full object-cover rounded-2xl" /> : <Shield className="text-white w-6 h-6" />}
          </div>
          <div>
            <h2 className="font-bold text-foreground">{company?.display_name}</h2>
            <p className="text-xs text-muted-foreground">Protocolo: #{request?.id.substring(0,8)}</p>
          </div>
        </div>

        <div className="space-y-4">
          {items?.map((item, idx) => {
            const upload = uploadsByItem[item.id];
            const isApproved = upload?.status === "approved";
            const isRejected = upload?.status === "rejected";
            const isPending = upload?.status === "pending";
            const staged = stagedFiles[item.id];

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-[2rem] border p-5 transition-all ${
                  isApproved ? "bg-success/5 border-success/30 opacity-70" :
                  isRejected ? "bg-destructive/5 border-destructive/40 shadow-lg" :
                  "bg-card border-border/60 shadow-sm"
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 ${
                    isApproved ? "bg-success border-success text-white" :
                    isRejected ? "bg-destructive border-destructive text-white" :
                    isPending ? "bg-amber-100 border-amber-300 text-amber-600" :
                    "border-muted bg-muted/30 text-muted-foreground"
                  }`}>
                    {isApproved ? <CheckCircle2 className="w-6 h-6" /> : isRejected ? <AlertTriangle className="w-6 h-6" /> : isPending ? <Clock className="w-5 h-5 animate-pulse" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className={`text-sm font-bold ${isApproved ? 'line-through' : ''}`}>{item.item_name}</h4>
                    <p className="text-[10px] text-muted-foreground uppercase mt-1">{item.stage_name}</p>
                    {isRejected && upload?.rejection_reason && (
                      <p className="mt-2 text-xs font-bold text-destructive">❌ {upload.rejection_reason}</p>
                    )}
                  </div>

                  {!isApproved && !staged && !uploadingItemId && (
                    <label className="cursor-pointer">
                      <input type="file" className="hidden" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) handleFileChange(item.id, f);
                        e.target.value = ""; // Reseta o input para permitir selecionar o mesmo arquivo se ele errar
                      }} />
                      <div className={`px-4 py-2 rounded-xl text-xs font-bold ${isRejected ? 'bg-destructive text-white' : 'bg-primary text-white'}`}>
                        {isRejected ? "Reenviar" : "Anexar"}
                      </div>
                    </label>
                  )}
                </div>

                {/* Exibe o FilePreviewThumbnail apenas quando tem um arquivo preparado localmente */}
                {staged && (
                  <div className="mt-4 pt-4 border-t border-dashed border-border/50">
                     <FilePreviewThumbnail
                       file={staged}
                       onRemove={() => setStagedFiles(prev => { const n = {...prev}; delete n[item.id]; return n; })}
                       onConfirm={() => confirmUpload(item.id)}
                       isUploading={uploadingItemId === item.id}
                       uploadProgress={uploadProgress}
                     />
                  </div>
                )}
                
                {isPending && !staged && <div className="mt-4 pt-3 border-t border-amber-200/50 text-[11px] font-bold text-amber-600">⏳ Arquivo enviado. Aguardando conferência do escritório...</div>}
                {isApproved && <div className="mt-4 pt-3 border-t border-success/20 text-[11px] font-bold text-success">✅ Arquivo validado!</div>}
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ChecklistUploadPage;
