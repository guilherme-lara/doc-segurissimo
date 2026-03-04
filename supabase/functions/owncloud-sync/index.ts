/**
 * OwnCloud WebDAV Sync — Edge Function
 * 
 * INTEGRAÇÃO OWNCLOUD (Plano PRO)
 * ────────────────────────────────
 * Esta função é chamada quando um profissional aprova um documento.
 * Ela faz download do arquivo do Supabase Storage e envia para o
 * servidor ownCloud configurado pelo profissional via protocolo WebDAV.
 *
 * FLUXO:
 * 1. Recebe uploadId do arquivo aprovado
 * 2. Busca dados do upload e da company (incluindo credenciais ownCloud)
 * 3. Faz download do arquivo do Supabase Storage
 * 4. Cria pasta do cliente no ownCloud via MKCOL (se não existir)
 * 5. Envia o arquivo via PUT para o ownCloud
 *
 * PROTOCOLO WEBDAV:
 * - MKCOL: Cria diretório remoto
 * - PUT: Envia arquivo para o servidor
 * - Autenticação: Basic Auth (usuário + token de aplicativo)
 *
 * NOTA PARA MIGRAÇÃO (jotatechinfo.com.br):
 * - Esta lógica pode ser replicada em C# usando HttpClient com WebDAV
 * - As credenciais ownCloud estão na tabela companies
 * - O path do arquivo segue: /remote.php/dav/files/{user}/{clientName}/{fileName}
 *
 * SEGURANÇA:
 * - Requer autenticação (JWT válido)
 * - Verifica que o upload pertence à company do usuário autenticado
 * - Credenciais ownCloud nunca são expostas ao cliente
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // 1. Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("[owncloud-sync] No auth header");
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[owncloud-sync] User authenticated:", user.id);

    // 2. Parse body
    const { uploadId } = await req.json();
    if (!uploadId) {
      return new Response(JSON.stringify({ error: "uploadId obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[owncloud-sync] Processing upload:", uploadId);

    // 3. Fetch upload details with request info
    const { data: upload, error: uploadError } = await supabaseAdmin
      .from("uploads")
      .select("*, request_items!inner(item_name, request_id, document_requests:request_id(client_name))")
      .eq("id", uploadId)
      .single();

    if (uploadError || !upload) {
      console.error("[owncloud-sync] Upload not found:", uploadError?.message);
      return new Response(JSON.stringify({ error: "Upload não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[owncloud-sync] Upload found:", upload.file_name, "status:", upload.status);

    // 4. Fetch company with ownCloud config
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .select("id, user_id, owncloud_url, owncloud_user, owncloud_token")
      .eq("id", upload.company_id)
      .single();

    if (companyError || !company) {
      console.error("[owncloud-sync] Company not found:", companyError?.message);
      return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    if (company.user_id !== user.id) {
      console.error("[owncloud-sync] Ownership mismatch:", company.user_id, "vs", user.id);
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Check ownCloud config
    if (!company.owncloud_url || !company.owncloud_user || !company.owncloud_token) {
      console.warn("[owncloud-sync] OwnCloud not configured for company:", company.id);
      return new Response(JSON.stringify({ error: "OwnCloud não configurado", code: "NOT_CONFIGURED" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[owncloud-sync] OwnCloud configured:", company.owncloud_url);

    // 6. Download file from Supabase Storage
    console.log("[owncloud-sync] Downloading from storage:", upload.file_path);
    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from("uploads")
      .download(upload.file_path);

    if (fileError || !fileData) {
      console.error("[owncloud-sync] Storage download failed:", fileError?.message);
      return new Response(JSON.stringify({ error: "Falha ao baixar arquivo do storage" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    console.log("[owncloud-sync] File downloaded, size:", fileData.size);

    // 7. Build WebDAV paths
    // Client name from nested relation
    const clientName = (upload as any).request_items?.document_requests?.client_name ?? "sem-nome";
    const sanitizedClient = clientName.replace(/[^a-zA-Z0-9À-ú\s\-_]/g, "").trim();
    const baseUrl = company.owncloud_url.replace(/\/+$/, "");
    const davBasePath = `/remote.php/dav/files/${company.owncloud_user}`;
    const folderPath = `${davBasePath}/Seguríssimo/${sanitizedClient}`;
    const filePath = `${folderPath}/${upload.file_name}`;

    const authBasic = btoa(`${company.owncloud_user}:${company.owncloud_token}`);
    const headers = { Authorization: `Basic ${authBasic}` };

    // 8. Create folder structure via MKCOL (ignore 405 = already exists)
    console.log("[owncloud-sync] Creating folder:", `${baseUrl}${davBasePath}/Seguríssimo`);
    const mkcolRoot = await fetch(`${baseUrl}${davBasePath}/Seguríssimo`, {
      method: "MKCOL",
      headers,
    });
    console.log("[owncloud-sync] MKCOL root status:", mkcolRoot.status);
    await mkcolRoot.text(); // consume body

    console.log("[owncloud-sync] Creating client folder:", `${baseUrl}${folderPath}`);
    const mkcolClient = await fetch(`${baseUrl}${folderPath}`, {
      method: "MKCOL",
      headers,
    });
    console.log("[owncloud-sync] MKCOL client status:", mkcolClient.status);
    await mkcolClient.text(); // consume body

    // 9. Upload file via PUT
    const putUrl = `${baseUrl}${filePath}`;
    console.log("[owncloud-sync] Uploading to:", putUrl);
    console.log("[owncloud-sync] File size:", fileData.size, "Content-Type:", upload.content_type);

    const arrayBuffer = await fileData.arrayBuffer();
    console.log("[owncloud-sync] ArrayBuffer size:", arrayBuffer.byteLength);

    const putResponse = await fetch(putUrl, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": upload.content_type ?? "application/octet-stream",
        "Content-Length": String(arrayBuffer.byteLength),
      },
      body: arrayBuffer,
    });

    const putStatus = putResponse.status;
    const putBody = await putResponse.text();
    console.log("[owncloud-sync] PUT response:", putStatus, putBody.slice(0, 200));

    if (putStatus >= 200 && putStatus < 300) {
      console.log("[owncloud-sync] ✅ File synced successfully to ownCloud!");
      return new Response(JSON.stringify({ success: true, path: filePath }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      const errorMsg = putStatus === 401 || putStatus === 403
        ? "Credenciais ownCloud inválidas ou sem permissão"
        : putStatus === 404
          ? "Caminho WebDAV não encontrado no servidor ownCloud"
          : `Erro WebDAV (HTTP ${putStatus})`;
      console.error("[owncloud-sync] ❌ WebDAV PUT failed:", putStatus, errorMsg, putBody);
      return new Response(JSON.stringify({ error: errorMsg, status: putStatus, details: putBody.slice(0, 500) }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("[owncloud-sync] Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
