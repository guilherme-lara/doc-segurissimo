/**
 * Download ZIP — Edge Function
 * 
 * Gera um arquivo .ZIP com todos os uploads aprovados de uma solicitação.
 * Requer autenticação JWT e verifica ownership da company.
 *
 * NOTA para migração (jotatechinfo.com.br):
 * - Substituir supabase.storage.download por acesso direto ao filesystem
 * - A lógica de ZIP pode ser replicada em C# com System.IO.Compression
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = [
  "https://doc-segurissimo.lovable.app",
  "https://doc-segurissimo.vercel.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("Origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[download-zip] No auth header");
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      console.error("[download-zip] Auth failed:", userError?.message);
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[download-zip] User:", user.id);

    const { requestId } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: "requestId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[download-zip] Request:", requestId);

    // Verify the request belongs to user's company
    const { data: docRequest, error: reqError } = await supabase
      .from("document_requests")
      .select("id, client_name, company_id, companies!inner(user_id)")
      .eq("id", requestId)
      .single();

    if (reqError || !docRequest) {
      console.error("[download-zip] Request not found:", reqError?.message);
      return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((docRequest as any).companies.user_id !== user.id) {
      console.error("[download-zip] Access denied");
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get approved uploads for this request via request_items
    const { data: requestItems } = await supabase
      .from("request_items")
      .select("id")
      .eq("request_id", requestId);

    if (!requestItems || requestItems.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum item encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itemIds = requestItems.map((i: any) => i.id);
    const { data: uploads, error: uploadsError } = await supabase
      .from("uploads")
      .select("file_name, file_path")
      .eq("status", "approved")
      .in("request_item_id", itemIds);

    if (uploadsError) {
      console.error("[download-zip] Uploads query error:", uploadsError.message);
      return new Response(JSON.stringify({ error: "Erro ao buscar arquivos" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!uploads || uploads.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo aprovado encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[download-zip] Found", uploads.length, "approved files");

    // Download each file and build ZIP using fflate
    const { zipSync } = await import("https://esm.sh/fflate@0.8.2");
    const filesData: Record<string, Uint8Array> = {};
    const nameCount: Record<string, number> = {};

    for (const upload of uploads) {
      const { data: fileData, error: dlError } = await supabase
        .storage
        .from("uploads")
        .download(upload.file_path);

      if (dlError || !fileData) {
        console.error(`[download-zip] Failed to download ${upload.file_path}:`, dlError?.message);
        continue;
      }

      let fileName = upload.file_name;
      if (nameCount[fileName]) {
        nameCount[fileName]++;
        const ext = fileName.lastIndexOf(".");
        fileName = ext > 0
          ? `${fileName.slice(0, ext)} (${nameCount[fileName]})${fileName.slice(ext)}`
          : `${fileName} (${nameCount[fileName]})`;
      } else {
        nameCount[fileName] = 1;
      }

      const arrayBuffer = await fileData.arrayBuffer();
      filesData[fileName] = new Uint8Array(arrayBuffer);
    }

    if (Object.keys(filesData).length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo pôde ser baixado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[download-zip] Zipping", Object.keys(filesData).length, "files");
    const zipped = zipSync(filesData);

    const clientName = (docRequest as any).client_name?.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").trim() || "documentos";
    console.log("[download-zip] ✅ ZIP created for:", clientName);

    return new Response(zipped, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${clientName} - Aprovados.zip"`,
      },
    });
  } catch (err) {
    console.error("[download-zip] Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno ao gerar ZIP" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
