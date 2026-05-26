// ============================================================
//  ui.js — Utilidades de UI compartidas
// ============================================================

// ── Toast ────────────────────────────────────────────────────
export function toast(msg, tipo = 'ok', duracion = 3000) {
  const el = document.createElement('div');
  el.className = `toast toast-${tipo}`;
  el.textContent = msg;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast-visible'));
  setTimeout(() => {
    el.classList.remove('toast-visible');
    setTimeout(() => el.remove(), 400);
  }, duracion);
}

// ── Loading overlay ──────────────────────────────────────────
export function showLoading(msg = 'Cargando…') {
  let el = document.getElementById('global-loading');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loading';
    el.innerHTML = `<div class="loading-inner"><div class="loading-spinner"></div><p>${msg}</p></div>`;
    document.body.appendChild(el);
  }
  el.style.display = 'flex';
}

export function hideLoading() {
  const el = document.getElementById('global-loading');
  if (el) el.style.display = 'none';
}

// ── Escape HTML ──────────────────────────────────────────────
export function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => (
    {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]
  ));
}

// ── Formato de fecha ─────────────────────────────────────────
export function formatFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('es-MX', { day:'2-digit', month:'short', year:'numeric' });
}

// ── Confirmación simple ──────────────────────────────────────
export function confirmar(msg) {
  return window.confirm(msg);
}

// ── Generar UID local (para uso offline/temporal) ────────────
export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
