// Edge Function: consulta o DJEN (CNJ) pelo número do processo.
// Usada pelo CRM quando o navegador não consegue chamar a API do DJEN direto (CORS).
// Deploy: supabase functions deploy djen-prazos
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const { numero_processo } = await req.json();
    const dig = String(numero_processo || '').replace(/\D/g, '');
    if (dig.length !== 20) {
      return new Response(JSON.stringify({ error: 'Número de processo inválido' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }
    const r = await fetch(`https://comunicaapi.pje.jus.br/api/v1/comunicacao?numeroProcesso=${dig}&itensPorPagina=100`);
    const body = await r.text();
    return new Response(body, { status: r.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
