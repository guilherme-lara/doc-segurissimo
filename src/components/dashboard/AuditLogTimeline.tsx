/**
 * AuditLogTimeline — Timeline de atividades (PRO feature)
 *
 * Exibe logs de auditoria em formato de timeline vertical:
 * - Link gerado
 * - Cliente visualizou o link
 * - Arquivo enviado
 * - Arquivo aprovado/rejeitado
 *
 * NOTA para migração: Os logs são inseridos via triggers SECURITY DEFINER
 * na tabela public.audit_logs. O frontend apenas faz SELECT.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link2, Eye, Upload, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface AuditLogTimelineProps {
  requestId: string;
  companyId: string;
}

const ACTION_CONFIG: Record<string, { icon: typeof Link2; color: string; label: string }> = {
  link_generated: { icon: Link2, color: "text-primary", label: "Link gerado" },
  client_viewed: { icon: Eye, color: "text-accent-foreground", label: "Cliente visualizou" },
  file_uploaded: { icon: Upload, color: "text-foreground", label: "Arquivo enviado" },
  file_approved: { icon: CheckCircle2, color: "text-success", label: "Arquivo aprovado" },
  file_rejected: { icon: XCircle, color: "text-destructive", label: "Arquivo rejeitado" },
};

const AuditLogTimeline = ({ requestId, companyId }: AuditLogTimelineProps) => {
  const { data: logs, isLoading } = useQuery({
    queryKey: ["audit-logs", requestId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("*")
        .eq("request_id", requestId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!requestId,
  });

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-1 flex-1">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!logs || logs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
        <Clock className="h-8 w-8" />
        <p className="text-sm">Nenhuma atividade registrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {logs.map((log, i) => {
        const config = ACTION_CONFIG[log.action] ?? { icon: Clock, color: "text-muted-foreground", label: log.action };
        const Icon = config.icon;
        return (
          <div key={log.id} className="flex gap-3 relative">
            {/* Vertical line */}
            {i < logs.length - 1 && (
              <div className="absolute left-4 top-8 bottom-0 w-px bg-border" />
            )}
            <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${config.color}`}>
              <Icon className="h-3.5 w-3.5" />
            </div>
            <div className="pb-5 min-w-0">
              <p className="text-sm font-medium text-card-foreground">{config.label}</p>
              {log.details && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.details}</p>}
              <p className="text-xs text-muted-foreground/60 mt-0.5">{formatTime(log.created_at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AuditLogTimeline;
