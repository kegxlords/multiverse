// api/admin-actions.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. STRICT ADMIN CHECK
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('Unauthorized');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid token');

    const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
    if (!profile || !profile.is_admin) throw new Error('Admin privileges required');

    const { action, payload } = req.body;

    // 2. ROUTE ACTIONS
    switch (action) {
      
      case 'get_stats':
        const [users, deposits, withdrawals] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('transactions').select('amount', { count: 'exact', head: true }).eq('type', 'deposit').eq('status', 'completed'),
          supabase.from('transactions').select('*', { count: 'exact', head: true }).in('type', ['deposit', 'withdrawal']).eq('status', 'pending')
        ]);
        return res.json({ success: true, data: { users: users.count, deposits: deposits.count, pending: withdrawals.count } });

      case 'update_settings':
        for (const [key, value] of Object.entries(payload)) {
          await supabase.from('settings').upsert({ key, value: String(value) });
        }
        return res.json({ success: true, message: 'Settings updated' });

      case 'create_gift_code':
        const { error: codeErr } = await supabase.from('gift_codes').insert({ code: payload.code.toUpperCase(), amount: payload.amount });
        if (codeErr) throw new Error('Code already exists or invalid');
        return res.json({ success: true, message: 'Gift code created' });

      case 'approve_deposit':
        await supabase.rpc('approve_transaction', { p_tx_id: payload.id, p_type: 'deposit' });
        return res.json({ success: true, message: 'Deposit approved and wallet credited' });

      case 'reject_deposit':
        await supabase.from('transactions').update({ status: 'rejected' }).eq('id', payload.id);
        return res.json({ success: true, message: 'Deposit rejected' });

      case 'approve_withdrawal':
        await supabase.from('transactions').update({ status: 'completed' }).eq('id', payload.id);
        return res.json({ success: true, message: 'Withdrawal marked as paid' });

      case 'reject_withdrawal':
        await supabase.rpc('reject_transaction', { p_tx_id: payload.id, p_type: 'withdrawal' });
        return res.json({ success: true, message: 'Withdrawal rejected and balance refunded' });

      case 'toggle_ban':
        const newStatus = !payload.is_active;
        await supabase.from('profiles').update({ is_active: newStatus }).eq('id', payload.user_id);
        return res.json({ success: true, message: `User ${newStatus ? 'unbanned' : 'banned'}` });

      case 'manual_credit':
        await supabase.rpc('manual_credit_user', { p_user_id: payload.user_id, p_amount: payload.amount });
        return res.json({ success: true, message: 'Wallet credited manually' });

      default:
        throw new Error('Invalid action');
    }

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
