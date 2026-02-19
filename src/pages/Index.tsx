import { Shield, Lock, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Portal Seguríssimo
        </h1>
      </div>

      <p className="mb-10 max-w-md text-center text-muted-foreground">
        Plataforma segura de recebimento de arquivos para profissionais e agências. 
        Envie e receba documentos com total confiança.
      </p>

      <div className="grid w-full max-w-lg gap-4">
        <Link
          to="/demo/enviar"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
            <CheckCircle2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-card-foreground">Área de Envio</p>
            <p className="text-sm text-muted-foreground">Enviar arquivos de forma segura</p>
          </div>
        </Link>

        <Link
          to="/demo/login"
          className="group flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:shadow-elevated"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 transition-colors group-hover:bg-primary/20">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-card-foreground">Painel do Profissional</p>
            <p className="text-sm text-muted-foreground">Acesse seu dashboard</p>
          </div>
        </Link>
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        Criptografia de ponta a ponta · Armazenamento seguro · White-label
      </p>
    </div>
  );
};

export default Index;
