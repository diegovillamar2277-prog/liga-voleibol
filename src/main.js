// ============================================================
//  main.js — Router principal de la aplicación
// ============================================================
import { initAuth, currentProfile, isAdmin, isLoggedIn, logout } from './auth/auth.js';
import { renderAuthScreen } from './auth/auth-ui.js';
import { renderAdminPanel }  from './admin/admin.js';
import { renderOrgPanel }    from './liga/liga-dashboard.js';
import { renderPublicView }  from './liga/public-view.js';
import { showLoading, hideLoading } from './lib/ui.js';

const app = document.getElementById('app');

// ── Arrancar ─────────────────────────────────────────────────
async function boot() {
  showLoading('Iniciando…');
  await initAuth();
  hideLoading();
  route();
}

// ── Router ───────────────────────────────────────────────────
function route() {
  // ¿Viene con código de liga en la URL? → vista pública
  const params = new URLSearchParams(location.search);
  const codigoURL = params.get('liga') || '';

  if (codigoURL) {
    renderPublicView(app, codigoURL);
    return;
  }

  // ¿Está logueado?
  if (isLoggedIn()) {
    if (isAdmin()) {
      renderAdminPanel(app);
    } else {
      renderOrgPanel(app);
    }
    return;
  }

  // Sin sesión y sin código → pantalla de acceso
  renderPublicView(app, '');
}

// ── Escuchar cambios de auth ─────────────────────────────────
document.addEventListener('auth-change', ({ detail }) => {
  if (detail.event === 'SIGNED_IN')  route();
  if (detail.event === 'SIGNED_OUT') renderPublicView(app, '');
});

// ── Escuchar navegación interna ──────────────────────────────
document.addEventListener('nav', ({ detail }) => {
  if (detail.page === 'login')  renderAuthScreen(app);
  if (detail.page === 'codigo') renderPublicView(app, '');
  if (detail.page === 'home')   route();
});

// ── Iniciar ──────────────────────────────────────────────────
boot();
