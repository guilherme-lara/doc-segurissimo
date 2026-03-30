import { useState, useCallback, useEffect, useMemo } from "react";
import { Shield, Upload, CheckCircle2, AlertTriangle, Lock, PartyPopper, Clock, Type, Loader2, ArrowRight } from "lucide-react";
import { useParams, Link } from "react-router-dom";
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

const ChecklistUploadPage = () => {
  const { slug, requestId } = useParams<{ slug: string; requestId: string }>();
  const queryClient = useQueryClient();
  
  // Estados de controle
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [stagedFiles, setStagedFiles] = useState<Record<string, File>>({});
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [gatePassed, setGatePassed] = useState(false);
  const [clientIp, setClientIp] = useState<string | null>(null);

  // Password protection
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordVerified, setPasswordVerified] = useState(false);

  // Captura IP para Auditoria LGPD
  useEffect(() => {
    fetch('https://api.ipify.org?format=json')
      .then(res => res.json())
      .then(data => setClientIp(data.ip))
      .catch(() => setClientIp("IP_UNAVAILABLE"));
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

  const { data: plan } = useQuery({
    queryKey: ["plan-watermark", company?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_plans").select("*").eq("company_id", company!.id).single();
      return data || { show_watermark: true, max_file_size_mb: 50, plan: "free" };
    },
    enabled: !!company?.id,
  });

  const { data: request, isLoading: requestLoading } = useQuery({
    queryKey: ["request", requestId],
    queryFn: async () => {
      const { data, error } = await supabase.from("document_requests").select("*").eq("id", requestId).single();
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });

  const { data: items, isLoading: itemsLoading } = useQuery({
    queryKey: ["request-items", requestId],
    queryFn: async () => {
      const { data, error } = await supabase.from("request_items").select("*").eq("request_id", requestId).order("sort_order", { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });

  const { data: uploads } = useQuery({
    queryKey: ["client-uploads", requestId],
    queryFn: async () => {
      const { data } = await supabase.from("uploads").select("*").in("request_item_id", items?.map(i => i.id) || []);
      return data || [];
    },
    enabled: !!items?.length,
  });

  // 2. Mapeamento de Status
  const uploadsByItem = useMemo(() => {
    const map: Record<string, any> = {};
    uploads?.forEach(u => { if (!map[u.request_item_id]) map[u.request_item_id] = u; });
    return map;
  }, [uploads]);

  // 3. REAL-TIME MAGIC ⚡ (Atualiza quando o profissional aprova/rejeita)
  useEffect(() => {
    if (!requestId) return;
    const channel = supabase.channel(`public-checklist-${requestId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "uploads" }, () => {
        queryClient.invalidateQueries({ queryKey: ["client-uploads", requestId] });
        queryClient.invalidateQueries({ queryKey: ["request-items", requestId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "request_items", filter: `request_id=eq.${requestId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["request-items", requestId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [requestId, queryClient]);

  // 4. Handlers de Upload
  const confirmUpload = async (itemId: string) => {
    const file = stagedFiles[itemId];
    if (!file || !company || !request) return;
    setUploadingItemId(itemId);
    setUploadProgress(10);
    try {
      const filePath = `${company.id}/${request.id}/${itemId}/${Date.now()}_${file.name}`;
      await supabase.storage.from("uploads").upload(filePath, file);
      setUploadProgress(60);
      await supabase.from("uploads").insert({
        request_item_id: itemId, company_id: company.id, file_name: file.name,
        file_size: file.size, file_path: filePath, content_type: file.type || "application/octet-stream",
        lgpd_consent: true, uploader_ip: clientIp || "CAPTURING"
      } as any);
      setUploadProgress(100);
      toast.success("Enviado com sucesso! ✅");
      setTimeout(() => {
        setUploadingItemId(null);
        setStagedFiles(prev => { const n = {...prev}; delete n[itemId]; return n; });
        queryClient.invalidateQueries({ queryKey: ["request-items", requestId] });
      }, 600);
    } catch (err) { toast.error("Erro no envio"); setUploadingItemId(null); }
  };

  const isPro = plan?.plan === "pro";
  const brandColor = isPro ? company?.primary_color : undefined;
  const needsPassword = !!request?.access_password && !passwordVerified;
  const allApproved = items?.length > 0 && items.every(item => uploadsByItem[item.id]?.status === "approved");

  if (companyLoading || requestLoading || itemsLoading) return <div className="p-12 max-w-lg mx-auto space-y-4"><Skeleton className="h-12 w-12 rounded-2xl" /><Skeleton className="h-6 w-48" /><Skeleton className="h-32 w-full rounded-3xl" /></div>;

  // --- TELA DE SENHA ---
  if (needsPassword) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-3xl gradient-primary flex items-center justify-center shadow-hero"><Lock className="text-white" /></div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold">Acesso Restrito</h2>
          <p className="text-sm text-muted-foreground">Digite a senha fornecida para acessar o checklist.</p>
        </div>
        <Input type="password" value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder="Senha de acesso" className="rounded-xl text-center h-12" onKeyDown={e => e.key === 'Enter' && passwordInput === request.access_password && setPasswordVerified(true)} />
        <Button onClick={() => passwordInput === request.access_password ? setPasswordVerified(true) : toast.error("Senha incorreta")} className="w-full rounded-xl h-12 gradient-primary shadow-hero">Acessar Documentos 🔓</Button>
      </motion.div>
    </div>
  );

  // --- TELA LGPD GATE ---
  if (!gatePassed && !allApproved) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md bg-card border border-border/60 rounded-[2.5rem] p-8 shadow-card text-center space-y-6">
        <div className="mx-auto w-20 h-20 rounded-[2rem] gradient-primary flex items-center justify-center shadow-hero">
          {isPro && company?.logo_url ? <img src={company.logo_url} className="w-full h-full object-cover rounded-[2rem]" /> : <Shield className="w-10 h-10 text-white" />}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{company?.display_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">Checklist de Documentos para <b>{request?.client_name}</b></p>
        </div>
        <div className="bg-accent/30 p-5 rounded-3xl border border-border/40 text-left space-y-4">
          <div className="flex gap-3">
            <Checkbox id="lgpd" checked={lgpdAccepted} onCheckedChange={checked => setLgpdAccepted(!!checked)} className="mt-1" />
            <Label htmlFor="lgpd" className="text-xs leading-relaxed text-muted-foreground cursor-pointer">
              Declaro que li e aceito os <Link to="/termos" className="text-primary font-bold hover:underline">Termos de Uso</Link> e a <Link to="/privacidade" className="text-primary font-bold hover:underline">Política de Privacidade</Link> (LGPD).
            </Label>
          </div>
        </div>
        <Button disabled={!lgpdAccepted} onClick={() => setGatePassed(true)} className="w-full h-14 rounded-2xl text-lg font-bold gradient-primary shadow-hero hover:shadow-glow transition-all">
          Começar Envio <ArrowRight className="ml-2" />
        </Button>
      </motion.div>
    </div>
  );

  // --- TELA DE SUCESSO (Tudo Aprovado) ---
  if (allApproved) return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-6">
        <div className="mx-auto w-24 h-24 rounded-[2rem] bg-success/10 flex items-center justify-center"><PartyPopper className="w-12 h-12 text-success" /></div>
        <div className="space-y-2">
          <h2 className="text-3xl font-extrabold">Tudo pronto! 🎉</h2>
          <p className="text-muted-foreground">Todos os seus documentos foram aprovados por <b>{company?.display_name}</b>.</p>
        </div>
        <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-success/10 text-success border border-success/20 font-bold">
          <CheckCircle2 className="w-5 h-5" /> {items.length} Documentos em ordem
        </div>
      </motion.div>
    </div>
  );

  // --- TELA PRINCIPAL DO CHECKLIST ---
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-xl mx-auto px-4 py-8 space-y-8">
        
        {/* Header Compacto */}
        <div className="flex items-center gap-4 bg-card border border-border/60 p-4 rounded-3xl shadow-sm">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shrink-0 shadow-sm">
             {isPro && company?.logo_url ? <img src={company.logo_url} className="w-full h-full object-cover rounded-2xl" /> : <Shield className="text-white w-6 h-6" />}
          </div>
          <div>
            <h2 className="font-bold text-foreground">{company?.display_name}</h2>
            <p className="text-xs text-muted-foreground">Envio seguro de documentos</p>
          </div>
        </div>

        {/* Progresso Real-time */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
            <span>Seu Progresso</span>
            <span className="text-foreground">{items?.filter(i => uploadsByItem[i.id]?.status === 'approved').length} de {items?.length} aprovados</span>
          </div>
          <Progress value={(items?.filter(i => uploadsByItem[i.id]?.status === 'approved').length / items?.length) * 100} className="h-3 rounded-full border border-border/40" />
        </div>

        {/* Lista de Itens */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {items?.map((item, idx) => {
              const upload = uploadsByItem[item.id];
              const isApproved = upload?.status === "approved";
              const isRejected = upload?.status === "rejected";
              const isPending = upload?.status === "pending";
              const staged = stagedFiles[item.id];

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`relative group rounded-[2rem] border p-5 transition-all duration-300 ${
                    isApproved ? "bg-success/5 border-success/30 opacity-80" :
                    isRejected ? "bg-destructive/5 border-destructive/40 shadow-lg ring-1 ring-destructive/20" :
                    "bg-card border-border/60 shadow-sm hover:shadow-md"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-colors ${
                      isApproved ? "bg-success border-success text-white" :
                      isRejected ? "bg-destructive border-destructive text-white" :
                      isPending ? "bg-amber-100 border-amber-300 text-amber-600" :
                      "border-muted bg-muted/30 text-muted-foreground"
                    }`}>
                      {isApproved ? <CheckCircle2 className="w-6 h-6" /> : 
                       isRejected ? <AlertTriangle className="w-6 h-6" /> : 
                       isPending ? <Clock className="w-5 h-5 animate-pulse" /> : 
                       <span className="text-sm font-bold">{idx + 1}</span>}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h4 className={`text-sm font-bold leading-tight ${isApproved ? 'text-success/70 line-through' : 'text-foreground'}`}>
                        {item.item_name}
                      </h4>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">{item.stage_name}</p>
                      
                      {isRejected && upload?.rejection_reason && (
                        <div className="mt-2 text-xs font-bold text-destructive bg-destructive/10 p-2 rounded-xl border border-destructive/20">
                          ⚠️ Recusado: {upload.rejection_reason}
                        </div>
                      )}
                    </div>

                    {!isApproved && !staged && !uploadingItemId && (
                      <label className="cursor-pointer">
                        <input type="file" className="hidden" onChange={e => {
                          const f = e.target.files?.[0];
                          if (f) validateAndProcessFile(f).then(res => res.valid && setStagedFiles(prev => ({...prev, [item.id]: res.processedFile!})));
                        }} />
                        <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wide transition-all ${
                          isRejected ? 'bg-destructive text-white shadow-hero' : 'bg-primary text-white shadow-sm hover:shadow-glow'
                        }`}>
                          {isRejected ? "Reenviar" : "Anexar"}
                        </div>
                      </label>
                    )}
                  </div>

                  {/* Preview do Arquivo Selecionado (Antes de Confirmar) */}
                  {staged && (
                    <div className="mt-4 pt-4 border-t border-dashed border-border/60">
                       <FilePreviewThumbnail
                         file={staged}
                         onRemove={() => setStagedFiles(prev => { const n = {...prev}; delete n[item.id]; return n; })}
                         onConfirm={() => confirmUpload(item.id)}
                         isUploading={uploadingItemId === item.id}
                         uploadProgress={uploadProgress}
                       />
                    </div>
                  )}
                  
                  {isPending && !staged && (
                    <div className="mt-2 text-[10px] font-bold text-amber-600 flex items-center gap-1 bg-amber-50 w-fit px-2 py-0.5 rounded-full">
                      <Loader2 className="w-3 h-3 animate-spin" /> Aguardando revisão do profissional...
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        <div className="pt-8 text-center space-y-4">
          <p className="text-[10px] text-muted-foreground/60 uppercase tracking-[0.2em]">
            Ambiente Seguro & Criptografado 🔒
          </p>
          {plan?.show_watermark && (
            <div className="text-xs text-muted-foreground/40">
              Processado via <b>Portal Seguríssimo</b>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChecklistUploadPage;
