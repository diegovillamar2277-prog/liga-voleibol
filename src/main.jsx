import '../styles.css';
import { createRoot } from 'react-dom/client';
import { ToastContainer } from './components/Toast.jsx';
import { initAuth, isAdmin, isLoggedIn } from './auth/auth.js';
import { renderAuthScreen, unmountAuthScreen }  from './auth/auth-ui.jsx';
import { renderAdminPanel, unmountAdminPanel }  from './admin/admin.jsx';
import { renderOrgPanel,   unmountOrgPanel }    from './liga/liga-dashboard.jsx';
import { renderPublicView, unmountPublicView }  from './liga/public-view.jsx';
import { showLoading, hideLoading }             from './lib/ui.js';

const app = document.getElementById('app');

const toastEl = document.createElement('div');
document.body.appendChild(toastEl);
createRoot(toastEl).render(<ToastContainer />);

// Desmontar todos los roots antes de montar uno nuevo.
// unmountPublicView era la pieza faltante — causaba el bug del botón salir.
function cleanup() {
  unmountAuthScreen();
  unmountAdminPanel();
  unmountOrgPanel();
  unmountPublicView();
}

async function boot() {
  showLoading('Iniciando…');
  await initAuth();
  hideLoading();

  // Detectar retorno de MercadoPago
  const params = new URLSearchParams(location.search);
  const pago   = params.get('pago');
  if (pago === 'ok') {
    window.history.replaceState({}, '', '/');
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('liga:toast', {
        detail: { msg: '🎉 ¡Pago exitoso! Tu Plan Pro ya está activo.', tipo: 'ok', duracion: 5000, id: Date.now() }
      }));
    }, 1000);
  } else if (pago === 'error') {
    window.history.replaceState({}, '', '/');
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('liga:toast', {
        detail: { msg: '❌ El pago no se completó. Intenta de nuevo.', tipo: 'error', duracion: 5000, id: Date.now() }
      }));
    }, 1000);
  } else if (pago === 'pendiente') {
    window.history.replaceState({}, '', '/');
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('liga:toast', {
        detail: { msg: '⏳ Pago pendiente. Te avisaremos cuando se confirme.', tipo: 'warn', duracion: 5000, id: Date.now() }
      }));
    }, 1000);
  }

  await route();
}

async function route() {
  const params    = new URLSearchParams(location.search);
  const codigoURL = params.get('liga') || '';

  if (codigoURL) { cleanup(); renderPublicView(app, codigoURL); return; }

  if (isLoggedIn()) {
    const mod = await import('./auth/auth.js');
    if (!mod.currentProfile) { cleanup(); renderPublicView(app, ''); return; }
    if (isAdmin()) { cleanup(); renderAdminPanel(app, mod.currentProfile); }
    else           { cleanup(); renderOrgPanel(app, mod.currentProfile); }
    return;
  }

  cleanup();
  renderPublicView(app, '');
}

document.addEventListener('auth-change', ({ detail }) => {
  if (detail.event === 'SIGNED_IN')  { window.history.replaceState({}, '', '/'); route(); }
  if (detail.event === 'SIGNED_OUT') { localStorage.removeItem('ligaActualId'); cleanup(); renderPublicView(app, ''); }
});

document.addEventListener('nav', ({ detail }) => {
  if (detail.page === 'login')  { cleanup(); renderAuthScreen(app); }
  if (detail.page === 'codigo') { cleanup(); renderPublicView(app, ''); }
  if (detail.page === 'home')   route();
});

boot();
