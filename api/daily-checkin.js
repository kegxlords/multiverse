import { getSupabaseAdmin, getUser } from './_core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const user = await getUser(req);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc('claim_daily_checkin', { p_user_id: user.id });
    if (error) throw new Error(error.message);

    const result = data?.[0] || data;
    const amount = Number(result?.amount || 0);
    const nextCheckin = result?.next_checkin || null;

    if (amount <= 0) {
      return res.status(200).json({
        success: false,
        already_claimed: true,
        next_checkin: nextCheckin,
        error: 'You have already claimed today\'s check-in reward.'
      });
    }

    return res.status(200).json({
      success: true,
      amount,
      next_checkin: nextCheckin,
      message: `Daily check-in reward: ₦${amount.toLocaleString()}`
    });
  } catch (error) {
    console.error('Daily check-in failed:', error);
    return res.status(400).json({ success: false, error: error.message });
  }
}
