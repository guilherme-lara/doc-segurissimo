/**
 * Create InfinitePay Checkout — Edge Function
 * 
 * Placeholder para integração com InfinitePay.
 * Quando a API key for configurada, gera um link de checkout PRO.
 * Por enquanto retorna um erro informativo.
 *
 * ── SEGURANÇA DE WEBHOOKS ──
 * Ao implementar o webhook de retorno do InfinitePay (POST /infinitepay-webhook),
 * é OBRIGATÓRIO validar o cabeçalho de assinatura (ex: X-InfinitePay-Signature)
 * comparando com HMAC-SHA256 do body usando o webhook secret compartilhado.
 * Isso impede fraudes de injeção de status "paid" por terceiros.
 *
 * Exemplo de validação (a implementar no webhook handler):
 *   const signature = req.headers.get("X-InfinitePay-Signature");
 *   const expectedSig = crypto.subtle.sign("HMAC", key, body);
 *   if (signature !== expectedSig) return new Response("Forbidden", { status: 403 });
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TODO: Integrar com API InfinitePay quando a chave for configurada
    // const INFINITEPAY_API_KEY = Deno.env.get("INFINITEPAY_API_KEY");
    // if (!INFINITEPAY_API_KEY) { ... }
    
    // Por enquanto, retorna erro informativo
    return new Response(
      JSON.stringify({
        error: "Integração de pagamento em configuração. Entre em contato pelo WhatsApp para assinar o plano PRO.",
        fallback_url: "https://wa.me/5514991712801?text=Ol%C3%A1!%20Quero%20assinar%20o%20plano%20PRO%20do%20Portal%20Segur%C3%ADssimo!",
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
