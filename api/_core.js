// api/_core.js
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin Client (Bypasses RLS for backend operations)
export const getSupabaseAdmin = () => {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
};

// Verify User Token
export const getUser = async (req) => {
  // Vercel's Node runtime exposes req.headers as a plain object. Supporting
  // Headers as well keeps this helper compatible with both runtimes.
  const authHeader = typeof req.headers?.get === 'function'
    ? req.headers.get('authorization')
    : req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader) throw new Error('Unauthorized: No token provided');
  
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const supabase = getSupabaseAdmin();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) throw new Error('Unauthorized: Invalid token');
  return user;
};

// Check if User is Admin
export const checkAdmin = async (userId) => {
  const supabase = getSupabaseAdmin();
  const { data: profile, error } = await supabase.from('profiles').select('is_admin').eq('id', userId).single();
  if (error || !profile || !profile.is_admin) throw new Error('Forbidden: Admin privileges required');
  return true;
};

// Standard JSON Response Helper
export const sendRes = (res, status, data) => {
  return res.status(status).json(data);
};
