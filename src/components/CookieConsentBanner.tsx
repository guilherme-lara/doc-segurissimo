import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

const COOKIE_KEY = "doc_segurissimo_cookie_consent";

const CookieConsentBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(COOKIE_KEY);
    if (!consent) {
      // Small delay for smoother UX
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_KEY, "accepted");
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-0 left-0 right-0 z-[100] p-4"
        >
          <div className="mx-auto max-w-2xl rounded-2xl border border-border/60 bg-card/95 backdrop-blur-xl shadow-elevated p-5">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-relaxed">
                  Usamos cookies para garantir segurança e a melhor experiência em nosso sistema. 
                  Ao continuar, você concorda com nossa{" "}
                  <span className="text-primary font-medium">Política de Privacidade</span>.
                </p>
              </div>
              <Button
                onClick={handleAccept}
                size="sm"
                className="rounded-xl gradient-primary text-primary-foreground shadow-hero hover:shadow-glow transition-all duration-300 shrink-0"
              >
                Aceitar
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CookieConsentBanner;
