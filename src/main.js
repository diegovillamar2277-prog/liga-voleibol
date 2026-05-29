import '../styles.css';
import { initAuth, isAdmin, isLoggedIn } from './auth/auth.js';
import { renderAuthScreen } from './auth/auth-ui.js';
import { renderAdminPanel }  from './admin/admin.js';
import { renderOrgPanel }    from './liga/liga-dashboard.jsx';
import { renderPublicView }  from './liga/public-view.jsx';
import { showLoading, hideLoading } from './lib/ui.js';

const app = document.getElementById('app');

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
    renderPublicView(app, codigoURL);
    return;
  }

  if (isLoggedIn()) {
    const mod = await import('./auth/auth.js');
    if (!mod.currentProfile) {
      renderPublicView(app, '');
      return;
    }
    if (isAdmin()) {
      renderAdminPanel(app);
    } else {
      renderOrgPanel(app);
    }
    return;
  }

  renderPublicView(app, '');
}

document.addEventListener('auth-change', ({ detail }) => {
  if (detail.event === 'SIGNED_IN') {
    window.history.replaceState({}, '', '/');
    route();
  }
  if (detail.event === 'SIGNED_OUT') {
    localStorage.removeItem('ligaActualId');
    renderPublicView(app, '');
  }
});

document.addEventListener('nav', ({ detail }) => {
  if (detail.page === 'login')  renderAuthScreen(app);
  if (detail.page === 'codigo') renderPublicView(app, '');
  if (detail.page === 'home')   route();
});

boot();