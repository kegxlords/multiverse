// api/admin-settings.js
import { getSupabaseAdmin, getUser, checkAdmin, sendRes } from './_core.js';

export default async function handler(req, res) {
  try {
    const user = await getUser(req);
    await checkAdmin(user.id); // STRICT ADMIN CHECK
    const supabase = getSupabaseAdmin();

    if (req.method !== 'POST') {
      return sendRes(res, 405, { error: 'Method not allowed' });
    }

    const { action, payload = {} } = req.body || {};

    if (action === 'get_stats') {
      const [users, deposits, pending] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'deposit').eq('status', 'completed'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).in('type', ['deposit', 'withdrawal']).eq('status', 'pending')
      ]);
      return sendRes(res, 200, {
        success: true,
        data: {
          users: users.count || 0,
          deposits: deposits.count || 0,
          pending: pending.count || 0
        }
      });
    }

    if (action === 'update_settings') {
      const percentageKeys = new Set(['referral_level_1_percent', 'referral_level_2_percent', 'referral_level_3_percent', 'withdrawal_fee_percent']);
      for (const [key, value] of Object.entries(payload)) {
        if (percentageKeys.has(key)) {
          const percentage = Number(value);
          if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
            throw new Error(`${key} must be between 0 and 100`);
          }
        }
        const { error } = await supabase.from('settings').upsert({ key, value: String(value) });
        if (error) throw new Error(error.message);
      }
      return sendRes(res, 200, { success: true, message: 'Settings updated successfully' });
    }

    return sendRes(res, 400, { error: 'Invalid action' });
  } catch (err) {
    return sendRes(res, 400, { error: err.message });
  }
}
