// api/wallet-transactions.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getBearerToken(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  return header.replace(/^Bearer\s+/i, '');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const token = getBearerToken(req);
    if (!token) throw new Error('Unauthorized');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid token');

    const { action, amount, sender_name, bank_name, account_number, account_name } = req.body || {};
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) throw new Error('Enter a valid amount');

    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('key, value')
      .in('key', ['min_withdrawal', 'deposit_min_amount', 'withdrawal_fee_percent', 'withdrawal_weekday_start', 'withdrawal_weekday_end', 'withdrawal_weekend_start', 'withdrawal_weekend_end']);
    if (settingsError) throw new Error('Unable to load transaction settings');
    const getSetting = key => settings?.find(item => item.key === key)?.value;

    if (action === 'deposit') {
      const minimum = Number(getSetting('deposit_min_amount') || 0);
      if (numericAmount < minimum) throw new Error(`Minimum deposit is ₦${minimum.toLocaleString()}`);
      if (!String(sender_name || '').trim()) throw new Error('Sender name is required');
      const reference = 'DEP-' + crypto.randomUUID();
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id, type: 'deposit', amount: numericAmount, description: `Sender: ${String(sender_name).trim()}`,
        reference, status: 'pending', bank_name, account_number, account_name
      });
      if (error) throw new Error(error.message);
      return res.status(200).json({ success: true, reference });
    }

    if (action === 'withdraw') {
      const { count: activePackageCount, error: packageError } = await supabase
        .from('user_miners')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'active');
      if (packageError) throw new Error('Unable to verify your active package');
      if (!activePackageCount) throw new Error('You need an active package before you can withdraw');
      const minWithdrawal = Number(getSetting('min_withdrawal') || 0);
      const feePercent = Number(getSetting('withdrawal_fee_percent') || 0);
      if (numericAmount < minWithdrawal) throw new Error(`Minimum withdrawal is ₦${minWithdrawal.toLocaleString()}`);
      if (!/^\d{10}$/.test(String(account_number || ''))) throw new Error('Account number must be 10 digits');

      // Vercel runs serverless functions in UTC. Withdrawal settings are
      // entered/displayed as Nigerian local time, so compare in Africa/Lagos.
      const now = new Date();
      const configuredTimezone = String(process.env.APP_TIMEZONE || 'Africa/Lagos').trim();
      let localParts;
      try {
        localParts = new Intl.DateTimeFormat('en-NG', {
          timeZone: configuredTimezone,
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23'
        }).formatToParts(now).reduce((parts, part) => {
          parts[part.type] = part.value;
          return parts;
        }, {});
      } catch {
        localParts = new Intl.DateTimeFormat('en-NG', {
          timeZone: 'Africa/Lagos',
          weekday: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23'
        }).formatToParts(now).reduce((parts, part) => {
          parts[part.type] = part.value;
          return parts;
        }, {});
      }
      const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(localParts.weekday);
      const currentTime = Number(localParts.hour) * 100 + Number(localParts.minute);
      const startText = getSetting(day >= 1 && day <= 5 ? 'withdrawal_weekday_start' : 'withdrawal_weekend_start') || '00:00';
      const endText = getSetting(day >= 1 && day <= 5 ? 'withdrawal_weekday_end' : 'withdrawal_weekend_end') || '23:59';
      const start = Number(startText.replace(':', ''));
      const end = Number(endText.replace(':', ''));
      if (currentTime < start || currentTime >= end) throw new Error('Withdrawals are currently closed');

      const fee = (numericAmount * feePercent) / 100;
      const netAmount = numericAmount - fee;
      const { data: transactionId, error } = await supabase.rpc('create_withdrawal_request', {
        p_user_id: user.id,
        p_amount: numericAmount,
        p_fee: fee,
        p_bank_name: bank_name,
        p_account_number: account_number,
        p_account_name: account_name
      });
      if (error) throw new Error(error.message);
      return res.status(200).json({ success: true, transactionId, fee, netAmount });
    }

    throw new Error('Invalid action');
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
}
