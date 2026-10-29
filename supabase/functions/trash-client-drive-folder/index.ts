// Manda para a lixeira do Drive a pasta de um lead SEM VIABILIDADE JURÍDICA.
// O lead continua no CRM; só o vínculo com a pasta é removido.
// Deploy: supabase functions deploy trash-client-drive-folder
import { createClient } from "npm:@supabase/supabase-js@2";
import { GoogleAuth } from "npm:google-auth-library@9";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function getAccessToken(): Promise<string> {
  const credentials = JSON.parse(Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON")!);
  const auth = new GoogleAuth({ credentials, scopes: ["https://www.googleapis.com/auth/drive"] });
  const client = await auth.getClient();
  const res = await client.getAccessToken();
  return res.token as string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // só usuários logados no CRM
    const jwt = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u, error: authErr } = await supabase.auth.getUser(jwt);
    if (authErr || !u?.user) return json({ error: "Não autorizado" }, 401);

    const { lead_id } = await req.json();
    if (!lead_id) return json({ error: "lead_id obrigatório" }, 400);

    const { data: lead, error } = await supabase.from("leads").select("id, nome, stage, drive_folder_url").eq("id", lead_id).single();
    if (error || !lead) return json({ error: "Lead não encontrado" }, 404);
    if (lead.stage !== "Sem viabilidade jurídica") return json({ error: "Só é possível apagar a pasta de leads em 'Sem viabilidade jurídica'" }, 400);

    const m = String(lead.drive_folder_url || "").match(/folders\/([A-Za-z0-9_-]+)/);
    if (!m) return json({ error: "Este lead não tem pasta no Drive" }, 400);

    const token = await getAccessToken();
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${m[1]}?supportsAllDrives=true`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
    if (!res.ok && res.status !== 404) throw new Error(await res.text());

    await supabase.from("leads").update({
      drive_folder_url: null,
      drive_folder_status: "Pasta enviada para a lixeira em " + new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    }).eq("id", lead.id);

    return json({ success: true });
  } catch (err) {
    console.error(err);
    return json({ error: String(err) }, 500);
  }
});
