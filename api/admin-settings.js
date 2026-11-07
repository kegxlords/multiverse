// api/admin-settings.js
import { getSupabaseAdmin, getUser, checkAdmin, sendRes } from './_core.js';

export default async function handler(req, res) {
  try {
    const user = await getUser(req);
    await checkAdmin(user.id); // STRICT ADMIN CHECK
    const supabase = getSupabaseAdmin();

    // GET: Dashboard Stats & Settings
    if (req.method === 'POST') {
      const [users, dep, withTx] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'deposit').eq('status', 'pending'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('type', 'withdrawal').eq('status', 'pending')
      ]);
      const { data: settings } = await supabase.from('settings').select('*');

      return sendRes(res, 200, { 
        success: true, 
        data: { 
          stats: { users: users.count, pendingDeposits: dep.count, pendingWithdrawals: withTx.count },
          settings: settings 
        } 
      });
    }

    // POST: Update Settings
    if (req.method === 'POST') {
      const payload = req.body;
      for (const [key, value] of Object.entries(payload)) {
        await supabase.from('settings').upsert({ key, value: String(value) });
      }
      return sendRes(res, 200, { success: true, message: 'Settings updated successfully' });
    }

    return sendRes(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendRes(res, 400, { error: err.message });
  }
}
