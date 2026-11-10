import { getSupabaseAdmin, getUser } from './_core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getUser(req);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('credit_due_miner_income_for_user', {
      p_user_id: user.id
    });
    if (error) throw new Error(error.message);

    const result = data?.[0] || data || {};
    return res.status(200).json({
      success: true,
      miners_paid: Number(result.miners_paid || 0),
      cycles_paid: Number(result.cycles_paid || 0),
      amount_paid: Number(result.amount_paid || 0),
      processed_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Page-open miner income claim failed:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
}
