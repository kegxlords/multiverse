/* ==========================================
   MULTIVERSE APP LOGIC
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  // 1. Handle Universe Loader
  const loader = document.getElementById('universeLoader');
  if (loader) {
    // Wait for the background image and SVG to fully load before fading out
    window.addEventListener('load', () => {
      setTimeout(() => {
        loader.classList.add('hidden');
        setTimeout(() => loader.remove(), 800);
      }, 1200); // Slight delay for dramatic effect
    });
  }

  // 2. Bottom Navigation Active State
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', function() {
      navItems.forEach(nav => nav.classList.remove('active'));
      this.classList.add('active');
    });
  });
});
