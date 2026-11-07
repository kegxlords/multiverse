// ==========================================
// SUPABASE INITIALIZATION
// ==========================================
const SUPABASE_URL = 'https://qgdbnraxlmdqjqnjwkke.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yUF4RKe5JIOGAB_Dt1wr4g_8qVEk_85';

if (window.supabase) {
  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error("Supabase library not loaded!");
}
