// ==========================================
// AUTH GUARD
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.supabaseClient) return;

  const { data: { session } } = await window.supabaseClient.auth.getSession();
  
  // If no session and we are not on the login/register/forgot pages, redirect to login
  const publicPages = ['index.html', 'register.html', 'forgot-password.html', '/'];
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  if (!session && !publicPages.includes(currentPage)) {
    window.location.href = 'index.html';
  }
});
