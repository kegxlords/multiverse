// api/miners.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Authenticate User
    const authHeader = req.headers.authorization;
    if (!authHeader) throw new Error('Unauthorized');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error('Invalid token');

    const { minerId } = req.body;
    if (!minerId) throw new Error('Miner ID required');

    // 2. Fetch Miner Details
    const { data: miner, error: minerError } = await supabase.from('miners').select('*').eq('id', minerId).single();
    if (minerError || !miner) throw new Error('Miner not found');

    // 3. Check Purchase Limit (5x)
    const { count, error: countError } = await supabase
      .from('user_miners').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('miner_id', minerId);
    
    if (count >= miner.purchase_limit) throw new Error(`Purchase limit of ${miner.purchase_limit} reached for this package.`);

    // 4. Check Wallet Balance
    const { data: wallet, error: walletError } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
    if (walletError || Number(wallet.balance) < Number(miner.price)) throw new Error('Insufficient balance.');

    // 5. Execute Purchase (Transaction)
    const { error: dbError } = await supabase.rpc('purchase_miner', { 
      p_user_id: user.id, 
      p_miner_id: minerId, 
      p_price: miner.price 
    });

    if (dbError) throw new Error(dbError.message);

    res.status(200).json({ success: true, message: 'Miner rented successfully!' });

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
