export async function onRequest(context) {
  if (context.request.method !== 'POST') return json({error:'Method not allowed'}, 405);
  const db = context.env.DB;
  const data = await context.request.json();
  if (data.event === 'charge.completed' && data.data?.tx_ref?.startsWith('GUITAR_')) {
    await db.prepare("UPDATE guitar_payments SET status = 'completed' WHERE flw_tx_ref = ?").bind(data.data.tx_ref).run();
  }
  return json({ok:true});
}
function json(d, s=200) { return new Response(JSON.stringify(d), {status:s, headers:{'Content-Type':'application/json'}}); }
