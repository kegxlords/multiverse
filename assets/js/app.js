/* ==========================================
   MULTIVERSE APP LOGIC
   ========================================== */
(function () {
  const IMPERSONATION_KEY = 'multiverse_impersonation';
  const ADMIN_SESSION_KEY = 'multiverse_admin_session';

  function readImpersonation() {
    try { return JSON.parse(localStorage.getItem(IMPERSONATION_KEY) || 'null'); } catch { return null; }
  }

  function createIcon(name, size = 20) {
    const paths = {
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      arrowLeft: '<path d="m15 18-6-6 6-6"/><path d="M9 12h11"/>',
      wallet: '<path d="M3 6.5A2.5 2.5 0 0 1 5.5 4H19a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5.5A2.5 2.5 0 0 1 3 17.5z"/><path d="M16 13h5M17 13a1 1 0 1 0 0 2 1 1 0 0 0 0-2"/>',
      card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
      gift: '<path d="M20 12v8H4v-8M2 8h20v4H2zM12 8v12M12 8H7.5a2.5 2.5 0 1 1 0-5C10 3 12 8 12 8Zm0 0h4.5a2.5 2.5 0 1 0 0-5C14 3 12 8 12 8Z"/>',
      send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
      chart: '<path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/>',
      shield: '<path d="M12 3 20 6v5c0 5-3.4 8.3-8 10-4.6-1.7-8-5-8-10V6z"/><path d="m9 12 2 2 4-4"/>'
    };
    return `<svg class="svg-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.chart}</svg>`;
  }

  function showImpersonationBanner() {
    const state = readImpersonation();
    if (!state || document.getElementById('impersonationBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'impersonationBanner';
    banner.className = 'impersonation-banner';
    banner.innerHTML = `<div class="impersonation-copy">${createIcon('shield', 18)}<span><strong>Impersonation active</strong><small>Viewing ${state.name || state.email || 'user'} as an administrator</small></span></div><button id="stopImpersonation" class="impersonation-stop">Stop impersonating</button>`;
    document.body.prepend(banner);
    document.getElementById('stopImpersonation').addEventListener('click', stopImpersonation);
  }

  async function stopImpersonation() {
    const adminSession = sessionStorage.getItem(ADMIN_SESSION_KEY);
    if (!adminSession || !window.supabaseClient) {
      localStorage.removeItem(IMPERSONATION_KEY);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      window.location.href = 'index.html';
      return;
    }
    const button = document.getElementById('stopImpersonation');
    if (button) { button.disabled = true; button.textContent = 'Restoring admin...'; }
    try {
      const session = JSON.parse(adminSession);
      const { error } = await window.supabaseClient.auth.setSession(session);
      if (error) throw error;
      localStorage.removeItem(IMPERSONATION_KEY);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      window.location.href = 'admin/index.html';
    } catch (error) {
      console.error('Unable to restore admin session:', error);
      if (button) { button.disabled = false; button.textContent = 'Restore admin session'; }
    }
  }

  window.MultiVerse = { createIcon, stopImpersonation, IMPERSONATION_KEY, ADMIN_SESSION_KEY };

  document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('universeLoader');
    if (loader) {
      const hide = () => setTimeout(() => { loader.classList.add('hidden'); setTimeout(() => loader.remove(), 800); }, 500);
      if (document.readyState === 'complete') hide(); else window.addEventListener('load', hide, { once: true });
    }
    document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', function () {
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
    }));
    showImpersonationBanner();
  });
})();
