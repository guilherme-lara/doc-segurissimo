import { useState } from "react";
import { Shield, Mail, Lock, ArrowRight, UserPlus, Sparkles } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

const AuthPage = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupConfirm, setSignupConfirm] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");

  const redirectToDashboard = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: adminRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (adminRole) {
        navigate("/admin/dashboard");
        return;
      }
      const { data: company } = await supabase
        .from("companies")
        .select("slug")
        .eq("user_id", user.id)
        .single();
      navigate(company ? `/${company.slug}/dashboard` : "/");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword,
      });
      if (error) throw error;
      toast.success("Bem-vindo de volta! 👋");
      await redirectToDashboard();
    } catch (error: any) {
      toast.error("Erro ao entrar", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (signupPassword !== signupConfirm) {
      toast.error("Senhas não coincidem");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
      });
      if (error) throw error;
      toast.success("Conta criada com sucesso! 🎉");
      await redirectToDashboard();
    } catch (error: any) {
      toast.error("Erro ao criar conta", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) {
      toast.error("Informe seu e-mail");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/auth/login`,
      });
      if (error) throw error;
      toast.success("E-mail de recuperação enviado! 📧", {
        description: "Verifique sua caixa de entrada e spam.",
        duration: 6000,
      });
      setShowForgotPassword(false);
      setForgotEmail("");
    } catch (error: any) {
      toast.error("Erro ao enviar e-mail", { description: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 relative">
      <div className="absolute inset-0 gradient-hero" />
      <div className="absolute top-20 right-20 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm relative"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Link to="/">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl gradient-primary shadow-hero">
              <Shield className="h-6 w-6 text-primary-foreground" />
            </div>
          </Link>
          <h1 className="text-xl font-bold text-foreground">Portal Seguríssimo</h1>
          <p className="text-sm text-muted-foreground">Acesse ou crie sua conta ✨</p>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card p-6 shadow-elevated">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 rounded-2xl">
              <TabsTrigger value="login" className="rounded-xl">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="rounded-xl">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="login-email" type="email" placeholder="seu@email.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} className="pl-10 rounded-xl" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="login-password" type="password" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} className="pl-10 rounded-xl" required />
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-2xl h-11 gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300" size="lg" disabled={isLoading}>
                  {isLoading ? "Entrando..." : <> Entrar <ArrowRight className="ml-2 h-4 w-4" /></>}
                </Button>
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setForgotEmail(loginEmail); }}
                  className="w-full text-xs text-muted-foreground hover:text-primary transition-colors mt-2"
                >
                  Esqueceu sua senha? 🔑
                </button>
              </form>

              {showForgotPassword && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  onSubmit={handleForgotPassword}
                  className="mt-4 space-y-3 border-t border-border/40 pt-4"
                >
                  <p className="text-xs text-muted-foreground">Digite seu e-mail para receber o link de recuperação:</p>
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="rounded-xl"
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1 rounded-xl" size="sm" disabled={isLoading}>
                      {isLoading ? "Enviando..." : "Enviar link 📧"}
                    </Button>
                    <Button type="button" variant="outline" className="rounded-xl" size="sm" onClick={() => setShowForgotPassword(false)}>
                      Cancelar
                    </Button>
                  </div>
                </motion.form>
              )
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-email">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="signup-email" type="email" placeholder="seu@email.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} className="pl-10 rounded-xl" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="signup-password" type="password" placeholder="Mínimo 6 caracteres" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} className="pl-10 rounded-xl" required minLength={6} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-confirm">Confirmar senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input id="signup-confirm" type="password" placeholder="Repita a senha" value={signupConfirm} onChange={(e) => setSignupConfirm(e.target.value)} className="pl-10 rounded-xl" required minLength={6} />
                  </div>
                </div>
                <Button type="submit" className="w-full rounded-2xl h-11 gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300" size="lg" disabled={isLoading}>
                  {isLoading ? "Criando..." : <><UserPlus className="mr-2 h-4 w-4" /> Criar conta</>}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Shield className="h-3 w-3" />
          <span>Acesso protegido com criptografia</span>
        </div>
      </motion.div>
    </div>
  );
};

export default AuthPage;
