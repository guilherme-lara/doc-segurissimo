/**
 * Download ZIP — Edge Function
 * 
 * Gera um arquivo .ZIP com todos os uploads aprovados de uma solicitação.
 * Requer autenticação JWT e verifica ownership da company.
 * CORS restrito a domínios oficiais.
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
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { requestId } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: "requestId é obrigatório" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: docRequest, error: reqError } = await supabase
      .from("document_requests")
      .select("id, client_name, company_id, companies!inner(user_id)")
      .eq("id", requestId)
      .single();

    if (reqError || !docRequest) {
      return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if ((docRequest as any).companies.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: requestItems } = await supabase
      .from("request_items")
      .select("id")
      .eq("request_id", requestId);

    if (!requestItems || requestItems.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum item encontrado" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const itemIds = requestItems.map((i: any) => i.id);
    const { data: uploads, error: uploadsError } = await supabase
      .from("uploads")
      .select("file_name, file_path")
      .eq("status", "approved")
      .in("request_item_id", itemIds);

    if (uploadsError) {
      return new Response(JSON.stringify({ error: "Erro ao buscar arquivos" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!uploads || uploads.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum arquivo aprovado encontrado" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { zipSync } = await import("https://esm.sh/fflate@0.8.2");
    const filesData: Record<string, Uint8Array> = {};
    const nameCount: Record<string, number> = {};

    for (const upload of uploads) {
      const { data: fileData, error: dlError } = await supabase.storage.from("uploads").download(upload.file_path);
      if (dlError || !fileData) continue;

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
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const zipped = zipSync(filesData);
    const clientName = (docRequest as any).client_name?.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").trim() || "documentos";

    return new Response(zipped, {
      headers: {
        ...cors,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${clientName} - Aprovados.zip"`,
      },
    });
  } catch (err) {
    const cors = getCorsHeaders(req);
    return new Response(JSON.stringify({ error: "Erro interno ao gerar ZIP" }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
