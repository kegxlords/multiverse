/* ==========================================
   MULTIVERSE APP LOGIC
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Handle Universe Loader
  const loader = document.getElementById('universeLoader');
  if (loader) {
    // Simulate loading resources (replace with actual init logic later)
    setTimeout(() => {
      loader.classList.add('hidden');
      // Remove from DOM after fade out to free memory
      setTimeout(() => loader.remove(), 800);
    }, 1500); 
  }

  // 2. Bottom Navigation Active State
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', function(e) {
      // Prevent default if it's just a demo, remove if using real hrefs
      // e.preventDefault(); 
      
      navItems.forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
    });
  });

  // 3. Simple Auth Check (Placeholder for Phase 2)
  // In Phase 2, we will replace this with Supabase session checking
  const path = window.location.pathname;
  if (path.includes('dashboard') || path.includes('wallet')) {
    console.log('Protected route accessed. Auth guard will be implemented in Phase 2.');
  }
});
