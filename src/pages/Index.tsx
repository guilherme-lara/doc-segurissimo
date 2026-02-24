import { ArrowRight, FileCheck, Link as LinkIcon, FolderOpen, Lock, CheckCircle2, ChevronRight, Sparkles, Star, Shield, Crown, Zap, Users, MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const } }),
};

const features = [
  {
    icon: LinkIcon,
    title: "Links Únicos 🔗",
    description: "Cada solicitação gera um link exclusivo. Sem confusão, sem perda de documentos.",
  },
  {
    icon: FileCheck,
    title: "Checklists Visuais ✅",
    description: "Seu cliente vê exatamente o que falta e acompanha o progresso em tempo real.",
  },
  {
    icon: FolderOpen,
    title: "Organização Mágica 📂",
    description: "Todos os arquivos organizados por cliente. Encontre qualquer documento em segundos.",
  },
];

const steps = [
  { number: "01", title: "Crie sua conta", description: "Cadastro rápido em menos de 1 minuto. Sem cartão." },
  { number: "02", title: "Monte o checklist", description: "Use templates prontos ou crie do zero." },
  { number: "03", title: "Envie o link", description: "Seu cliente recebe e envia tudo organizado." },
];

const testimonials = [
  { name: "Ana Lúcia", role: "Contadora — SP", text: "Reduzi em 70% o tempo que gastava cobrando documentos dos clientes. O sistema é simples e funcional.", stars: 5 },
  { name: "Roberto Melo", role: "Advogado — BH", text: "A organização por solicitação mudou meu fluxo de trabalho. Recomendo para qualquer escritório.", stars: 5 },
  { name: "Carla Santos", role: "Agência — RJ", text: "Interface intuitiva, até meus clientes menos tecnológicos conseguem enviar os documentos sem ajuda.", stars: 5 },
];

const Index = () => {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Nav */}
      <nav className="glass sticky top-0 z-50 border-b border-border/50">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl gradient-primary">
              <Shield className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground tracking-tight">Seguríssimo</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/auth/login">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground transition-colors">
                Entrar
              </Button>
            </Link>
            <Link to="/auth/login">
              <Button size="sm" className="gradient-primary text-primary-foreground rounded-xl shadow-hero hover:shadow-glow transition-all duration-300">
                Começar grátis
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 gradient-hero" />
        <div className="absolute top-20 left-10 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute bottom-20 right-10 h-96 w-96 rounded-full bg-primary/3 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-24 md:py-36">
          <motion.div
            className="mx-auto max-w-3xl text-center"
            initial="hidden"
            animate="visible"
          >
            <motion.div
              custom={0}
              variants={fadeUp}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Plataforma segura para profissionais
            </motion.div>
            <motion.h1
              custom={1}
              variants={fadeUp}
              className="text-4xl font-extrabold tracking-tight text-foreground md:text-6xl lg:text-7xl leading-[1.05]"
            >
              Pare de caçar documentos
              <br />
              <span className="text-gradient">no WhatsApp. 📂</span>
            </motion.h1>
            <motion.p
              custom={2}
              variants={fadeUp}
              className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed"
            >
              Crie checklists inteligentes, envie links únicos e receba tudo organizado.
              A ferramenta que contadores, advogados e agências precisam.
            </motion.p>
            <motion.div custom={3} variants={fadeUp} className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Link to="/auth/login">
                <Button size="lg" className="text-base px-8 rounded-2xl gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300 h-12">
                  Começar Agora ✨ <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">Grátis para sempre · Sem cartão de crédito</p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 relative">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">Tudo que você precisa ⚡</h2>
            <p className="mt-3 text-muted-foreground text-lg">Simplificado em uma plataforma moderna.</p>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="rounded-3xl border border-border/60 bg-card p-8 shadow-card hover:shadow-elevated transition-all duration-300 group"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent group-hover:bg-primary/10 transition-colors">
                  <f.icon className="h-5 w-5 text-accent-foreground group-hover:text-primary transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-card-foreground">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">Como funciona 🚀</h2>
            <p className="mt-3 text-muted-foreground text-lg">Três passos. Zero complicação.</p>
          </motion.div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div
                key={s.number}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="relative flex items-start gap-5 rounded-3xl bg-card border border-border/60 p-6 shadow-card"
              >
                <span className="text-5xl font-extrabold text-primary/15 leading-none">{s.number}</span>
                <div>
                  <h3 className="font-semibold text-foreground text-lg">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                </div>
                {i < steps.length - 1 && (
                  <ChevronRight className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 h-6 w-6 text-border z-10" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">Planos que cabem no bolso 💰</h2>
            <p className="mt-3 text-muted-foreground text-lg">Comece grátis. Faça upgrade quando precisar.</p>
          </motion.div>
          <div className="grid gap-8 md:grid-cols-2 max-w-3xl mx-auto">
            {/* Free */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-3xl border border-border/60 bg-card p-8 shadow-card"
            >
              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground">Grátis</h3>
                <p className="mt-1 text-sm text-muted-foreground">Para sempre. Sem surpresas.</p>
                <div className="mt-4">
                  <span className="text-4xl font-extrabold text-foreground">R$0</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {["Até 5 solicitações ativas", "Upload de até 50MB por arquivo", "Checklist com templates", "Link único por solicitação", "Marca d'água Seguríssimo"].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth/login">
                <Button variant="outline" className="w-full rounded-2xl h-11 transition-all duration-300 hover:bg-accent">
                  Começar grátis
                </Button>
              </Link>
            </motion.div>

            {/* Pro */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="rounded-3xl border-2 border-primary/30 bg-card p-8 shadow-glow relative overflow-hidden"
            >
              <div className="absolute top-4 right-4 inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Crown className="h-3 w-3" /> Popular
              </div>
              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground">Pro ✨</h3>
                <p className="mt-1 text-sm text-muted-foreground">Para profissionais exigentes.</p>
                <div className="mt-4">
                  <span className="text-4xl font-extrabold text-foreground">R$49</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>
              </div>
              <ul className="space-y-3 mb-8">
                {[
                  "Solicitações ilimitadas",
                  "Upload de até 1GB por arquivo",
                  "White-label (sem marca d'água)",
                  "Lembrete Mágico (WhatsApp/Email) 🪄",
                  "Senha de acesso no link do cliente",
                  "Suporte prioritário",
                ].map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-foreground">
                    <Zap className="h-4 w-4 text-primary shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth/login">
                <Button className="w-full rounded-2xl h-11 gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300">
                  Começar com Pro <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-muted/30">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            className="text-center mb-16"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl font-bold text-foreground md:text-4xl">Quem usa, aprova 💜</h2>
            <p className="mt-3 text-muted-foreground text-lg">Veja o que profissionais estão dizendo.</p>
          </motion.div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="rounded-3xl border border-border/60 bg-card p-7 shadow-card"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-pro text-pro" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                    {t.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24">
        <div className="mx-auto max-w-2xl text-center px-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="rounded-3xl border border-primary/20 bg-accent/50 p-12 shadow-glow"
          >
            <div className="mb-5 inline-flex items-center justify-center h-16 w-16 rounded-3xl bg-primary/10 animate-float">
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-3xl font-bold text-foreground">Pronto para organizar? 🎯</h2>
            <p className="mt-3 text-muted-foreground text-lg">
              Junte-se a profissionais que já simplificaram o recebimento de documentos.
            </p>
            <Link to="/auth/login">
              <Button size="lg" className="mt-8 px-8 rounded-2xl h-12 gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300">
                Criar minha conta ✨ <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg gradient-primary">
              <Shield className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-muted-foreground">Portal Seguríssimo</span>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Todos os direitos reservados</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
