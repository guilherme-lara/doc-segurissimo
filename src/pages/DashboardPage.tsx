import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  Shield,
  Copy,
  Check,
  Download,
  FileText,
  Settings,
  LogOut,
  Link as LinkIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data — will be replaced by Supabase queries
const mockFiles = [
  { id: 1, name: "contrato-social.pdf", size: "2.4 MB", date: "18/02/2026", sender: "Cliente A" },
  { id: 2, name: "balanco-2025.xlsx", size: "1.8 MB", date: "17/02/2026", sender: "Cliente B" },
  { id: 3, name: "notas-fiscais-jan.zip", size: "12.3 MB", date: "15/02/2026", sender: "Cliente C" },
  { id: 4, name: "comprovante-pgto.pdf", size: "340 KB", date: "14/02/2026", sender: "Cliente D" },
];

const DashboardPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [copied, setCopied] = useState(false);
  const [displayName, setDisplayName] = useState(
    slug ? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : ""
  );
  const [slugValue, setSlugValue] = useState(slug || "");

  const uploadLink = `${window.location.origin}/${slug}/enviar`;

  const handleCopy = () => {
    navigator.clipboard.writeText(uploadLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Portal Seguríssimo</span>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">
        {/* Share link */}
        <div className="mb-8 rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center gap-2 mb-3">
            <LinkIcon className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Seu link de recebimento</h2>
          </div>
          <div className="flex gap-2">
            <Input value={uploadLink} readOnly className="bg-muted font-mono text-sm" />
            <Button onClick={handleCopy} variant="outline" className="shrink-0">
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4 text-success" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" /> Copiar
                </>
              )}
            </Button>
          </div>
        </div>

        <Tabs defaultValue="files" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="files">
              <FileText className="mr-2 h-4 w-4" />
              Arquivos Recebidos
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="mr-2 h-4 w-4" />
              Configurações
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files">
            <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Arquivo</TableHead>
                    <TableHead>Remetente</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell className="text-muted-foreground">{file.sender}</TableCell>
                      <TableCell className="text-muted-foreground">{file.size}</TableCell>
                      <TableCell className="text-muted-foreground">{file.date}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm">
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="settings">
            <div className="rounded-xl border border-border bg-card p-6 shadow-card">
              <h3 className="mb-4 text-sm font-semibold text-foreground">Configurações da Conta</h3>
              <div className="space-y-4 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="display-name">Nome de Exibição</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Seu nome ou nome da empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug da URL</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">portalsegurissimo.com/</span>
                    <Input
                      id="slug"
                      value={slugValue}
                      onChange={(e) => setSlugValue(e.target.value)}
                      placeholder="sua-empresa"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Este será o endereço do seu portal de recebimento de arquivos.
                  </p>
                </div>
                <Button>Salvar alterações</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default DashboardPage;
