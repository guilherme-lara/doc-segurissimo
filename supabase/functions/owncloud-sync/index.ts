/**
 * OwnCloud WebDAV Sync — Edge Function
 * 
 * INTEGRAÇÃO OWNCLOUD (Plano PRO)
 * ────────────────────────────────
 * Esta função é chamada quando um profissional aprova um documento.
 * Ela faz download do arquivo do Supabase Storage e envia para o
 * servidor ownCloud configurado pelo profissional via protocolo WebDAV.
 *
 * SEGURANÇA:
 * - CORS restrito a domínios oficiais
 * - Requer autenticação (JWT válido)
 * - Verifica ownership do upload
 * - Credenciais ownCloud nunca são expostas ao cliente
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[owncloud-sync] No auth header");
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      console.error("[owncloud-sync] Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    console.log("[owncloud-sync] User authenticated:", user.id);

    const { uploadId } = await req.json();
    if (!uploadId) {
      return new Response(JSON.stringify({ error: "uploadId obrigatório" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: upload, error: uploadError } = await supabaseAdmin
      .from("uploads")
      .select("*, request_items!inner(item_name, request_id, document_requests:request_id(client_name))")
      .eq("id", uploadId)
      .single();

    if (uploadError || !upload) {
      console.error("[owncloud-sync] Upload not found:", uploadError?.message);
      return new Response(JSON.stringify({ error: "Upload não encontrado" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, user_id, owncloud_url, owncloud_user, owncloud_token")
      .eq("id", upload.company_id)
      .single();

    if (companyError || !company) {
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (company.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!company.owncloud_url || !company.owncloud_user || !company.owncloud_token) {
      return new Response(JSON.stringify({ error: "OwnCloud não configurado", code: "NOT_CONFIGURED" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from("uploads")
      .download(upload.file_path);

    if (fileError || !fileData) {
      return new Response(JSON.stringify({ error: "Falha ao baixar arquivo do storage" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const clientName = (upload as any).request_items?.document_requests?.client_name ?? "sem-nome";
    const sanitizedClient = clientName.replace(/[^a-zA-Z0-9À-ú\s\-_]/g, "").trim();

    const rawOwncloudUrl = (company.owncloud_url ?? "").trim();
    const normalizedBase = /^https?:\/\//i.test(rawOwncloudUrl) ? rawOwncloudUrl : `https://${rawOwncloudUrl}`;
    let baseUrl: string;
    try {
      baseUrl = new URL(normalizedBase).toString().replace(/\/+$/, "");
    } catch {
      return new Response(JSON.stringify({ error: "URL do ownCloud inválida", code: "INVALID_OWNCLOUD_URL" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const davBasePath = `/remote.php/dav/files/${company.owncloud_user}`;
    const folderPath = `${davBasePath}/Seguríssimo/${sanitizedClient}`;
    const filePath = `${folderPath}/${upload.file_name}`;
    const authBasic = btoa(`${company.owncloud_user}:${company.owncloud_token}`);
    const headers = { Authorization: `Basic ${authBasic}` };

    await fetch(`${baseUrl}${davBasePath}/Seguríssimo`, { method: "MKCOL", headers }).then(r => r.text());
    await fetch(`${baseUrl}${folderPath}`, { method: "MKCOL", headers }).then(r => r.text());

    const arrayBuffer = await fileData.arrayBuffer();
    const putResponse = await fetch(`${baseUrl}${filePath}`, {
      method: "PUT",
      headers: { ...headers, "Content-Type": upload.content_type ?? "application/octet-stream", "Content-Length": String(arrayBuffer.byteLength) },
      body: arrayBuffer,
    });

    const putStatus = putResponse.status;
    const putBody = await putResponse.text();

    if (putStatus >= 200 && putStatus < 300) {
      return new Response(JSON.stringify({ success: true, path: filePath }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    } else {
      const errorMsg = putStatus === 401 || putStatus === 403
        ? "Credenciais ownCloud inválidas ou sem permissão"
        : putStatus === 404 ? "Caminho WebDAV não encontrado" : `Erro WebDAV (HTTP ${putStatus})`;
      return new Response(JSON.stringify({ error: errorMsg, status: putStatus, details: putBody.slice(0, 500) }), {
        status: 502, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    const cors = getCorsHeaders(req);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
