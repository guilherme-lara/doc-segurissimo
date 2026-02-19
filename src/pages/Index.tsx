import { Shield, ArrowRight, FileCheck, Link as LinkIcon, FolderOpen, Lock, CheckCircle2, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const features = [
  {
    icon: LinkIcon,
    title: "Links Seguros e Únicos",
    description: "Cada solicitação gera um link exclusivo. Seus clientes enviam documentos de forma direcionada, sem confusão.",
  },
  {
    icon: FileCheck,
    title: "Checklists por Etapa",
    description: "Defina exatamente quais documentos precisa. O cliente vê o que falta e acompanha o progresso em tempo real.",
  },
  {
    icon: FolderOpen,
    title: "Organização Automática",
    description: "Todos os arquivos são organizados por cliente e solicitação. Encontre qualquer documento em segundos.",
  },
];

const steps = [
  { number: "01", title: "Crie sua conta", description: "Cadastro rápido em menos de 1 minuto." },
  { number: "02", title: "Monte o checklist", description: "Defina os documentos que precisa receber." },
  { number: "03", title: "Envie o link", description: "Seu cliente recebe e envia tudo organizado." },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold text-foreground tracking-tight">Seguríssimo</span>
          </div>
          <Link to="/auth/login">
            <Button variant="outline" size="sm">
              Entrar
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary">
              <Lock className="h-3.5 w-3.5" />
              Recebimento seguro de documentos
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground md:text-6xl leading-[1.1]">
              Pare de pedir documentos
              <br />
              <span className="text-primary">por e-mail.</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Crie checklists inteligentes, envie links únicos e receba tudo organizado. 
              A ferramenta que contadores, advogados e agências precisam.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link to="/auth/login">
                <Button size="lg" className="text-base px-8 shadow-hero">
                  Começar Agora <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">Grátis para começar · Sem cartão de crédito</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-border bg-card/50 py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground">Tudo que você precisa</h2>
            <p className="mt-3 text-muted-foreground">Simplificado em uma plataforma segura.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-border bg-card p-7 shadow-card hover:shadow-elevated transition-shadow"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-card-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground">Como funciona</h2>
            <p className="mt-3 text-muted-foreground">Três passos. Zero complicação.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.number} className="relative flex items-start gap-4">
                <span className="text-4xl font-bold text-primary/20">{s.number}</span>
                <div>
                  <h3 className="font-semibold text-foreground">{s.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.description}</p>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden md:block absolute right-0 top-3 h-5 w-5 text-border" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-card/50 py-20">
        <div className="mx-auto max-w-2xl text-center px-4">
          <div className="mb-4 inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-3xl font-bold text-foreground">Pronto para organizar?</h2>
          <p className="mt-3 text-muted-foreground">
            Junte-se a profissionais que já simplificaram o recebimento de documentos.
          </p>
          <Link to="/auth/login">
            <Button size="lg" className="mt-6 px-8 shadow-hero">
              Criar minha conta <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Portal Seguríssimo</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Todos os direitos reservados</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
