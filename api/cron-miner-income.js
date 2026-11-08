import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function suppliedSecret(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim();
  const querySecret = req.query?.secret || req.body?.secret || '';
  return bearer || querySecret;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const expected = process.env.CRON_SECRET;
  if (!expected || suppliedSecret(req) !== expected) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { data, error } = await supabase.rpc('credit_due_miner_income');
    if (error) throw new Error(error.message);

    const result = data?.[0] || data || {
      miners_paid: 0,
      cycles_paid: 0,
      amount_paid: 0
    };

    return res.status(200).json({
      success: true,
      processed_at: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    console.error('Miner income cron failed:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
