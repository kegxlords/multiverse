// api/impersonate.js
import { getSupabaseAdmin, getUser, checkAdmin, sendRes } from './_core.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return sendRes(res, 405, { error: 'Method not allowed' });

  try {
    const adminUser = await getUser(req);
    await checkAdmin(adminUser.id);

    const { userId } = req.body || {};
    if (!userId || userId === adminUser.id) {
      return sendRes(res, 400, { error: 'Choose a different user to impersonate' });
    }

    const supabase = getSupabaseAdmin();
    const { data: target, error: targetError } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_active')
      .eq('id', userId)
      .single();

    if (targetError || !target?.email) {
      return sendRes(res, 404, { error: 'User account not found' });
    }
    if (target.is_active === false) {
      return sendRes(res, 400, { error: 'Suspended users cannot be impersonated' });
    }

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const origin = req.headers.origin || process.env.PUBLIC_APP_URL || (host ? `${protocol}://${host}` : '');
    if (!origin) throw new Error('PUBLIC_APP_URL is not configured');
    const redirectTo = `${origin.replace(/\/$/, '')}/dashboard.html`;
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: target.email,
      options: { redirectTo }
    });

    if (linkError || !linkData?.properties?.action_link) {
      throw new Error(linkError?.message || 'Unable to create impersonation session');
    }

    return sendRes(res, 200, {
      success: true,
      actionLink: linkData.properties.action_link,
      user: { id: target.id, email: target.email, full_name: target.full_name }
    });
  } catch (err) {
    return sendRes(res, 400, { error: err.message });
  }
}
