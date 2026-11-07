// api/auth-profile.js
import { getSupabaseAdmin, getUser, sendRes } from './_core.js';

export default async function handler(req, res) {
  try {
    const user = await getUser(req);
    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
      // Fetch Profile, Wallet, and Referral Code
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      const { data: wallet } = await supabase.from('wallets').select('balance').eq('user_id', user.id).single();
      
      return sendRes(res, 200, { success: true, data: { profile, wallet } });
    } 
    
    if (req.method === 'POST') {
      const { full_name, phone, bank_name, account_number, account_name } = req.body;
      
      const { error } = await supabase.from('profiles').update({
        full_name, phone, bank_name, account_number, account_name
      }).eq('id', user.id);

      if (error) throw new Error(error.message);
      return sendRes(res, 200, { success: true, message: 'Profile updated' });
    }

    return sendRes(res, 405, { error: 'Method not allowed' });
  } catch (err) {
    return sendRes(res, 400, { error: err.message });
  }
}
