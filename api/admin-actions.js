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

      case 'get_stats': {
        const [users, deposits, withdrawals] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('transactions').select('amount', { count: 'exact', head: true }).eq('type', 'deposit').eq('status', 'completed'),
          supabase.from('transactions').select('*', { count: 'exact', head: true }).in('type', ['deposit', 'withdrawal']).eq('status', 'pending')
        ]);
        return res.json({ success: true, data: { users: users.count, deposits: deposits.count, pending: withdrawals.count } });
      }

      case 'update_settings': {
        for (const [key, value] of Object.entries(payload)) {
          await supabase.from('settings').upsert({ key, value: String(value) });
        }
        return res.json({ success: true, message: 'Settings updated' });
      }

      case 'create_gift_code': {
        const { error: codeErr } = await supabase.from('gift_codes').insert({ code: payload.code.toUpperCase(), amount: payload.amount });
        if (codeErr) throw new Error('Code already exists or invalid');
        return res.json({ success: true, message: 'Gift code created' });
      }

      case 'approve_deposit': {
        const { error } = await supabase.rpc('approve_transaction', { p_tx_id: payload.id, p_type: 'deposit' });
        if (error) throw new Error(error.message);
        return res.json({ success: true, message: 'Deposit approved and wallet credited' });
      }

      case 'reject_deposit': {
        const { error } = await supabase.rpc('reject_transaction', { p_tx_id: payload.id, p_type: 'deposit' });
        if (error) throw new Error(error.message);
        return res.json({ success: true, message: 'Deposit rejected' });
      }

      case 'approve_withdrawal': {
        const { error } = await supabase.rpc('approve_transaction', { p_tx_id: payload.id, p_type: 'withdrawal' });
        if (error) throw new Error(error.message);
        return res.json({ success: true, message: 'Withdrawal marked as paid' });
      }

      case 'reject_withdrawal': {
        const { error } = await supabase.rpc('reject_transaction', { p_tx_id: payload.id, p_type: 'withdrawal' });
        if (error) throw new Error(error.message);
        return res.json({ success: true, message: 'Withdrawal rejected and balance refunded' });
      }

      case 'toggle_ban': {
        if (!payload.user_id) throw new Error('User is required');
        if (payload.user_id === user.id) throw new Error('You cannot ban your own admin account');
        const newStatus = !payload.is_active;
        const { error } = await supabase.from('profiles').update({ is_active: newStatus }).eq('id', payload.user_id);
        if (error) throw new Error(error.message);
        return res.json({ success: true, message: newStatus ? 'User unbanned' : 'User banned' });
      }

      case 'manual_credit': {
        const amount = Number(payload.amount);
        if (!Number.isFinite(amount) || amount <= 0) throw new Error('Credit amount must be greater than zero');
        const { error } = await supabase.rpc('manual_credit_user', { p_user_id: payload.user_id, p_amount: amount });
        if (error) throw new Error(error.message);
        return res.json({ success: true, message: 'Wallet credited manually' });
      }

      case 'adjust_balance': {
        const amount = Number(payload.amount);
        if (!Number.isFinite(amount) || amount === 0) throw new Error('Balance adjustment cannot be zero');
        if (!payload.user_id) throw new Error('User is required');
        if (amount > 0) {
          const { error } = await supabase.rpc('manual_credit_user', {
            p_user_id: payload.user_id,
            p_amount: amount
          });
          if (error) throw new Error(error.message);
        } else {
          const debit = Math.abs(amount);
          const { data: wallet, error: walletError } = await supabase
            .from('wallets').select('balance').eq('user_id', payload.user_id).maybeSingle();
          if (walletError) throw new Error(walletError.message);
          if (!wallet || Number(wallet.balance || 0) < debit) throw new Error('Insufficient wallet balance');
          const { data: updatedWallet, error: updateError } = await supabase
            .from('wallets')
            .update({ balance: Number(wallet.balance) - debit })
            .eq('user_id', payload.user_id)
            .eq('balance', Number(wallet.balance))
            .select('balance')
            .maybeSingle();
          if (updateError) throw new Error(updateError.message);
          if (!updatedWallet) throw new Error('Balance changed while processing; please try again');
          const { error: transactionError } = await supabase.from('transactions').insert({
            user_id: payload.user_id,
            type: 'manual_credit',
            amount: debit,
            description: 'Manual admin debit',
            status: 'completed',
            reference: 'ADM-' + crypto.randomUUID(),
            metadata: { direction: 'debit', admin_id: user.id }
          });
          if (transactionError) throw new Error(transactionError.message);
        }
        return res.json({
          success: true,
          message: amount > 0 ? 'Funds added successfully' : 'Funds deducted successfully'
        });
      }

      case 'assign_miner': {
        const { error } = await supabase.rpc('admin_assign_miner', { p_user_id: payload.user_id, p_miner_id: payload.miner_id });
        if (error) throw new Error(error.message);
        return res.json({ success: true, message: 'Miner assigned successfully' });
      }

      case 'create_miner': {
        const { error: mErr } = await supabase.from('miners').insert({
          name: payload.name, price: payload.price, daily_revenue: payload.daily_revenue,
          duration_days: payload.duration_days, purchase_limit: payload.purchase_limit || 5,
          image_url: payload.image_url || '', is_active: true
        });
        if (mErr) throw new Error(mErr.message);
        return res.json({ success: true, message: 'Miner created' });
      }

      case 'update_miner': {
        const price = Number(payload.price);
        const dailyRevenue = Number(payload.daily_revenue);
        const durationDays = Number(payload.duration_days);
        const purchaseLimit = Number(payload.purchase_limit);
        if (!payload.id || !payload.name?.trim()) throw new Error('Package name is required');
        if (![price, dailyRevenue, durationDays, purchaseLimit].every(Number.isFinite) || price < 0 || dailyRevenue < 0 || durationDays <= 0 || purchaseLimit <= 0) {
          throw new Error('Enter valid package values');
        }
        const { error } = await supabase.from('miners').update({
          name: payload.name.trim(), price, daily_revenue: dailyRevenue,
          duration_days: durationDays, purchase_limit: purchaseLimit,
          image_url: payload.image_url || ''
        }).eq('id', payload.id);
        if (error) throw new Error(error.message);
        return res.json({ success: true, message: 'Package updated successfully' });
      }

      case 'delete_miner': {
        const { error } = await supabase.from('miners').update({ is_active: false }).eq('id', payload.id);
        if (error) throw new Error(error.message);
        return res.json({ success: true, message: 'Miner deactivated' });
      }

      default:
        throw new Error('Invalid action');
    }

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
