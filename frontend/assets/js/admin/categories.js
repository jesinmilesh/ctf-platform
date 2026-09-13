/**
 * XPLOITX // CYBER BATTLEFIELD
 * Admin Categories (assets/js/admin/categories.js)
 */

document.addEventListener('DOMContentLoaded', async () => {
  Sidebar.render('admin-sidebar-container', 'categories');
  await window.authManager.requireAdmin('/admin/login.html');

  const container = document.getElementById('categoriesGridSlot');

  async function loadCategories() {
    try {
      const res = await window.api.admin.getCategories();
      const list = res.categories || [];

      container.innerHTML = list.map(cat => `
        <div style="background:var(--bg-card); border:1px solid var(--border); border-left:4px solid ${cat.color_accent || '#00ff9c'}; border-radius:var(--radius-sm); padding:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <h3 style="font-family:var(--font-heading); font-size:18px; font-weight:700; color:#fff; margin:0;">
              ${window.Utils.escapeHTML(cat.name)}
            </h3>
            <span style="font-family:var(--font-mono); font-size:11px; color:${cat.color_accent || '#00ff9c'}; font-weight:700;">
              ORDER #${cat.display_order || 1}
            </span>
          </div>
          <p style="color:var(--text-secondary); font-size:13px; margin:0 0 12px 0;">
            ${window.Utils.escapeHTML(cat.description || 'Sector category')}
          </p>
          <div style="font-family:var(--font-mono); font-size:11px; color:var(--text-muted);">
            ACCENT: <code style="color:${cat.color_accent || '#00ff9c'};">${cat.color_accent || '#00ff9c'}</code>
          </div>
        </div>
      `).join('');

    } catch (err) {
      console.error('Failed to load categories:', err);
    }
  }

  loadCategories();
});
