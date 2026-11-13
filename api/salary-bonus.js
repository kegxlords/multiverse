import { getSupabaseAdmin, getUser } from './_core.js';

export default async function handler(req, res) {
  try {
    const user = await getUser(req);
    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
      const [level1, level2, level3, claims] = await Promise.all([
        supabase.from('profiles').select('id, has_deposited').eq('referred_by', user.id),
        supabase.from('profiles').select('id, has_deposited').eq('upline_level_2', user.id),
        supabase.from('profiles').select('id, has_deposited').eq('upline_level_3', user.id),
        supabase.from('salary_claims').select('milestone, amount, claim_month, claimed_at').eq('user_id', user.id)
      ]);
      const members = new Map();
      for (const row of [...(level1.data || []), ...(level2.data || []), ...(level3.data || [])]) members.set(row.id, row);
      return res.status(200).json({
        success: true,
        active_members: [...members.values()].filter(row => row.has_deposited).length,
        claims: claims.data || []
      });
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    const milestone = Number(req.body?.milestone);
    if (!Number.isInteger(milestone)) return res.status(400).json({ error: 'A valid milestone is required' });

    const { data, error } = await supabase.rpc('claim_salary_bonus', {
      p_user_id: user.id,
      p_milestone: milestone
    });
    if (error) throw new Error(error.message);

    const result = data?.[0] || data || {};
    return res.status(200).json({
      success: result.success === true,
      milestone: Number(result.milestone || milestone),
      amount: Number(result.amount || 0),
      active_members: Number(result.active_members || 0),
      message: result.message || 'Salary claim processed'
    });
  } catch (error) {
    console.error('Salary claim failed:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
}
