// ============================================================
//  ui.js — Utilidades compartidas
// ============================================================

// ── Toast — dispara evento que ToastContainer escucha ────────
export function toast(msg, tipo = 'ok', duracion = 3000) {
  document.dispatchEvent(new CustomEvent('liga:toast', {
    detail: { msg, tipo, duracion, id: Date.now() + Math.random() }
  }));
}

// ── Loading overlay (usado solo en boot antes de React) ──────
export function showLoading(msg = 'Cargando…') {
  let el = document.getElementById('global-loading');
  if (el) { el.style.display = 'flex'; return; }
  el = document.createElement('div');
  el.id = 'global-loading';
  el.style.cssText = 'display:flex;position:fixed;inset:0;background:var(--bg);z-index:9999;align-items:center;justify-content:center;flex-direction:column;gap:1rem';
  el.innerHTML = '<div class="spinner"></div><p class="muted">' + msg + '</p>';
  document.body.appendChild(el);
}

export function hideLoading() {
  const el = document.getElementById('global-loading');
  if (el) el.remove();
}

// ── Escape HTML ──────────────────────────────────────────────
export function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

// ── Formato de fecha ─────────────────────────────────────────
export function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Confirmación ─────────────────────────────────────────────
export function confirmar(msg) {
  return window.confirm(msg);
}

// ── UID local ────────────────────────────────────────────────
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
