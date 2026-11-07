// api/wallet-transactions.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Authenticate User
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('Unauthorized');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid token');

    const { action, amount, bank_name, account_number, account_name } = req.body;

    // Fetch user wallet
    const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
    if (!wallet) throw new Error('Wallet not found');

    if (action === 'deposit') {
      // Create deposit request
      const reference = 'DEP-' + Date.now();
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'deposit',
        amount: amount,
        description: 'Deposit request',
        reference: reference,
        status: 'pending',
        bank_name: bank_name,
        account_number: account_number,
        account_name: account_name
      });

      if (error) throw new Error('Failed to create deposit request');
      return res.status(200).json({ success: true, reference });

    } else if (action === 'withdraw') {
      // Check minimum withdrawal
      const { data: settings } = await supabase.from('settings').select('value').in('key', ['min_withdrawal', 'withdrawal_fee_percent', 'withdrawal_weekday_start', 'withdrawal_weekday_end', 'withdrawal_weekend_start', 'withdrawal_weekend_end']);
      const getSetting = (key) => settings?.find(s => s.key === key)?.value || '0';
      
      const minWithdrawal = parseFloat(getSetting('min_withdrawal'));
      const feePercent = parseFloat(getSetting('withdrawal_fee_percent'));
      
      if (amount < minWithdrawal) throw new Error(`Minimum withdrawal is ₦${minWithdrawal.toLocaleString()}`);
      if (amount > Number(wallet.balance)) throw new Error('Insufficient balance');

      // Check withdrawal time restrictions
      const now = new Date();
      const day = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const hour = now.getHours();
      const minute = now.getMinutes();
      const currentTime = hour * 100 + minute; // e.g., 14:30 = 1430

      let isWithdrawalOpen = false;
      
      if (day >= 1 && day <= 5) {
        // Weekdays (Mon-Fri)
        const start = getSetting('withdrawal_weekday_start').replace(':', '');
        const end = getSetting('withdrawal_weekday_end').replace(':', '');
        isWithdrawalOpen = currentTime >= parseInt(start) && currentTime < parseInt(end);
      } else {
        // Weekends (Sat-Sun)
        const start = getSetting('withdrawal_weekend_start').replace(':', '');
        const end = getSetting('withdrawal_weekend_end').replace(':', '');
        isWithdrawalOpen = currentTime >= parseInt(start) && currentTime < parseInt(end);
      }

      if (!isWithdrawalOpen) {
        throw new Error('Withdrawals are only processed Mon-Fri (8AM-6PM) and Weekends (10AM-5PM)');
      }

      // Calculate fee and net amount
      const fee = (amount * feePercent) / 100;
      const netAmount = amount - fee;

      // Create withdrawal request
      const reference = 'WTH-' + Date.now();
      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        type: 'withdrawal',
        amount: amount,
        description: `Withdrawal request (Fee: ₦${fee.toLocaleString()})`,
        reference: reference,
        status: 'pending',
        bank_name: bank_name,
        account_number: account_number,
        account_name: account_name
      });

      if (error) throw new Error('Failed to create withdrawal request');
      return res.status(200).json({ success: true, reference, fee, netAmount });
    }

    throw new Error('Invalid action');

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
