import '../styles.css';
import { initAuth, isAdmin, isLoggedIn, currentProfile } from './auth/auth.js';
import { renderAuthScreen } from './auth/auth-ui.js';
import { renderAdminPanel }  from './admin/admin.js';
import { renderOrgPanel, unmountOrgPanel } from './liga/liga-dashboard.jsx';
import { renderPublicView }  from './liga/public-view.jsx';
import { showLoading, hideLoading } from './lib/ui.js';

const app = document.getElementById('app');

function cleanup() {
  unmountOrgPanel();
}

async function boot() {
  showLoading('Iniciando…');
  await initAuth();
  hideLoading();
  await route();
}

async function route() {
  const params    = new URLSearchParams(location.search);
  const codigoURL = params.get('liga') || '';

  if (codigoURL) {
    cleanup();
    renderPublicView(app, codigoURL);
    return;
  }

  if (isLoggedIn()) {
    // Re-importar para obtener el currentProfile actualizado tras initAuth/login
    const mod = await import('./auth/auth.js');
    if (!mod.currentProfile) {
      cleanup();
      renderPublicView(app, '');
      return;
    }
    if (isAdmin()) {
      cleanup();
      renderAdminPanel(app);
    } else {
      // Pasar el perfil como prop — evita leer un binding de módulo ES que puede ser null
      renderOrgPanel(app, mod.currentProfile);
    }
    return;
  }

  cleanup();
  renderPublicView(app, '');
}

document.addEventListener('auth-change', ({ detail }) => {
  if (detail.event === 'SIGNED_IN') {
    window.history.replaceState({}, '', '/');
    route();
  }
  if (detail.event === 'SIGNED_OUT') {
    localStorage.removeItem('ligaActualId');
    cleanup();
    renderPublicView(app, '');
  }
});

document.addEventListener('nav', ({ detail }) => {
  if (detail.page === 'login')  { cleanup(); renderAuthScreen(app); }
  if (detail.page === 'codigo') { cleanup(); renderPublicView(app, ''); }
  if (detail.page === 'home')   route();
});

boot();
