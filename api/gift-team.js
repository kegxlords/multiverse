// api/gift-team.js
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

    const { action, code } = req.body;

    if (action === 'redeem_code') {
      if (!code) throw new Error('Gift code is required');

      // 2. Find the code (Case insensitive)
      const { data: giftCode, error: codeError } = await supabase
        .from('gift_codes')
        .select('*')
        .eq('code', code.toUpperCase())
        .single();

      if (codeError || !giftCode) throw new Error('Invalid gift code');
      if (giftCode.is_used) throw new Error('This gift code has already been used');

      // 3. Credit the user's wallet and mark code as used
      const { error: dbError } = await supabase.rpc('redeem_gift_code', {
        p_user_id: user.id,
        p_code_id: giftCode.id,
        p_amount: giftCode.amount
      });

      if (dbError) throw new Error(dbError.message);

      return res.status(200).json({ 
        success: true, 
        message: `Successfully redeemed ₦${Number(giftCode.amount).toLocaleString()}!` 
      });
    }

    throw new Error('Invalid action');

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
