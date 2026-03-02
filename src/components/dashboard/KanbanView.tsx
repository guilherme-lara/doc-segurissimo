/**
 * KanbanView — Visão Kanban do Dashboard
 * 
 * Colunas:
 * - Aguardando Envio: nenhum item completado
 * - Em Revisão: alguns itens completados, mas nem todos aprovados
 * - Concluído: todos itens aprovados
 */

import { motion } from "framer-motion";
import { Copy, Check, LockIcon, MessageCircle, Archive, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface KanbanRequest {
  id: string;
  client_name: string;
  created_at: string;
  access_password?: string | null;
  expires_at?: string | null;
  request_items?: { id: string; item_name: string; is_completed: boolean; stage_name: string }[];
}

interface KanbanViewProps {
  requests: KanbanRequest[];
  uploads: any[];
  isPro: boolean;
  slug: string;
  copiedId: string | null;
  downloadingZipId: string | null;
  onCopy: (id: string) => void;
  onReminder: (req: any) => void;
  onDownloadZip: (id: string, name: string) => void;
  onUpgradeModal: () => void;
  formatDate: (d: string) => string;
}

type Column = "waiting" | "reviewing" | "completed";

const COLUMNS: { key: Column; label: string; emoji: string; color: string }[] = [
  { key: "waiting", label: "Aguardando Envio", emoji: "📩", color: "border-t-accent-foreground/30" },
  { key: "reviewing", label: "Em Revisão", emoji: "🔍", color: "border-t-pro" },
  { key: "completed", label: "Concluído", emoji: "✅", color: "border-t-success" },
];

function classifyRequest(req: KanbanRequest, uploads: any[]): Column {
  const items = req.request_items ?? [];
  if (items.length === 0) return "waiting";

  const itemIds = new Set(items.map((i) => i.id));
  const reqUploads = uploads.filter((u: any) => itemIds.has(u.request_item_id));

  // Check if all approved
  const allApproved = items.every((item) => {
    const upload = reqUploads.find((u: any) => u.request_item_id === item.id);
    return upload?.status === "approved";
  });
  if (allApproved) return "completed";

  // Check if any completed/uploaded
  const anyCompleted = items.some((i) => i.is_completed);
  if (anyCompleted) return "reviewing";

  return "waiting";
}

export default function KanbanView({
  requests, uploads, isPro, slug, copiedId, downloadingZipId,
  onCopy, onReminder, onDownloadZip, onUpgradeModal, formatDate,
}: KanbanViewProps) {
  const grouped: Record<Column, KanbanRequest[]> = { waiting: [], reviewing: [], completed: [] };
  
  for (const req of requests) {
    const col = classifyRequest(req, uploads ?? []);
    grouped[col].push(req);
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {COLUMNS.map((col) => (
        <div key={col.key} className={`rounded-2xl border border-border/60 bg-card/50 p-4 border-t-4 ${col.color}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              {col.emoji} {col.label}
            </h3>
            <Badge variant="secondary" className="text-xs rounded-full">
              {grouped[col.key].length}
            </Badge>
          </div>
          <div className="space-y-3 min-h-[120px]">
            {grouped[col.key].length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Nenhuma solicitação</p>
            ) : (
              grouped[col.key].map((req, i) => {
                const completed = req.request_items?.filter((item) => item.is_completed).length ?? 0;
                const total = req.request_items?.length ?? 0;

                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="rounded-xl border border-border/60 bg-card p-4 shadow-card hover:shadow-elevated transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-1.5">
                          {req.client_name}
                          {req.access_password && <LockIcon className="h-3 w-3 text-pro" />}
                        </h4>
                        <p className="text-[11px] text-muted-foreground">{formatDate(req.created_at)}</p>
                      </div>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        completed === total && total > 0 ? "bg-success/10 text-success" : "bg-accent text-accent-foreground"
                      }`}>
                        {completed}/{total}
                      </span>
                    </div>

                    {/* Item pills */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {req.request_items?.slice(0, 4).map((item) => (
                        <span key={item.id} className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          item.is_completed ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                        }`}>
                          {item.item_name}
                        </span>
                      ))}
                      {(req.request_items?.length ?? 0) > 4 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          +{(req.request_items?.length ?? 0) - 4}
                        </span>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-1.5 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => onCopy(req.id)} className="rounded-lg h-7 text-[11px] px-2">
                        {copiedId === req.id ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => onReminder(req)} className="rounded-lg h-7 text-[11px] px-2">
                        {!isPro && <LockIcon className="mr-0.5 h-2.5 w-2.5" />}
                        <MessageCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={downloadingZipId === req.id}
                        onClick={() => onDownloadZip(req.id, req.client_name)}
                        className="rounded-lg h-7 text-[11px] px-2"
                      >
                        {downloadingZipId === req.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Archive className="h-3 w-3" />}
                      </Button>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
