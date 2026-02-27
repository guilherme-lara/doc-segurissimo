import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { zipSync, strToU8 } from "https://esm.sh/fflate@0.8.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { requestId } = await req.json();
    if (!requestId) {
      return new Response(JSON.stringify({ error: "requestId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the request belongs to user's company
    const { data: docRequest, error: reqError } = await supabase
      .from("document_requests")
      .select("id, client_name, company_id, companies!inner(user_id)")
      .eq("id", requestId)
      .single();

    if (reqError || !docRequest) {
      return new Response(JSON.stringify({ error: "Solicitação não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if ((docRequest as any).companies.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get approved uploads for this request
    const { data: uploads, error: uploadsError } = await supabase
      .from("uploads")
      .select("file_name, file_path, request_item_id, request_items!inner(request_id)")
      .eq("status", "approved")
      .eq("request_items.request_id", requestId);

    if (uploadsError) {
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

    // Download each file and build zip
    const filesData: Record<string, Uint8Array> = {};
    const nameCount: Record<string, number> = {};

    for (const upload of uploads) {
      const { data: fileData, error: dlError } = await supabase
        .storage
        .from("uploads")
        .download(upload.file_path);

      if (dlError || !fileData) {
        console.error(`Failed to download ${upload.file_path}:`, dlError);
        continue;
      }

      // Handle duplicate names
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

    const zipped = zipSync(filesData);

    const clientName = (docRequest as any).client_name?.replace(/[^a-zA-Z0-9À-ÿ\s-]/g, "").trim() || "documentos";

    return new Response(zipped, {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${clientName} - Aprovados.zip"`,
      },
    });
  } catch (err) {
    console.error("ZIP error:", err);
    return new Response(JSON.stringify({ error: "Erro interno ao gerar ZIP" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
