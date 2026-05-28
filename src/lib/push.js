// ============================================================
//  push.js — Notificaciones push para partidos nuevos
//
//  Usa la Push API del navegador con notificaciones locales
//  (sin servidor de push externo — funciona dentro del SW).
//
//  API pública:
//    requestPermission() → 'granted' | 'denied' | 'default'
//    isPushSupported()   → boolean
//    getPermissionStatus() → 'granted' | 'denied' | 'default'
//    notifyNuevoPartido(ligaNombre, equipoA, marcador, equipoB)
//    notifyDesdePartidoGuardado(liga, partido)
// ============================================================

// ── Soporte ──────────────────────────────────────────────────
export function isPushSupported() {
  return 'Notification' in window && 'serviceWorker' in navigator;
}

export function getPermissionStatus() {
  if (!isPushSupported()) return 'denied';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

// ── Pedir permiso ─────────────────────────────────────────────
export async function requestPermission() {
  if (!isPushSupported()) return 'denied';
  if (Notification.permission === 'granted') return 'granted';
  const result = await Notification.requestPermission();
  return result;
}

// ── Enviar notificación local vía SW ─────────────────────────
// (no requiere servidor VAPID — funciona en la misma app)
async function showNotification(title, body, url = '/') {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;

  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, {
      body,
      icon:     '/icons/icon-192.png',
      badge:    '/icons/icon-192.png',
      tag:      'partido-nuevo',
      renotify: true,
      data:     url,
    });
    return true;
  } catch (err) {
    // Fallback: Notification directa si SW no está listo
    try {
      new Notification(title, { body, icon: '/icons/icon-192.png' });
      return true;
    } catch (_) {
      return false;
    }
  }
}

// ── Notificación de partido nuevo ────────────────────────────
export async function notifyNuevoPartido(ligaNombre, equipoA, marcador, equipoB) {
  const title = `🏐 ${ligaNombre}`;
  const body  = `Partido registrado: ${equipoA} ${marcador} ${equipoB}`;
  return showNotification(title, body);
}

// Helper que recibe el objeto liga y partido directamente
export async function notifyDesdePartidoGuardado(liga, partido) {
  const nombre   = liga?.nombre || 'Liga Voleibol';
  const eA       = partido?.equipo_a || '?';
  const eB       = partido?.equipo_b || '?';
  const marcador = partido?.sets_a != null
    ? `${partido.sets_a}:${partido.sets_b}`
    : 'vs';
  return notifyNuevoPartido(nombre, eA, marcador, eB);
}

// ── UI helper: botón de activar notificaciones ───────────────
// Llama a esta función pasándole un contenedor para agregar el toggle
export function renderPushToggle(container) {
  if (!isPushSupported()) return; // navegador no soporta

  const status = getPermissionStatus();

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;align-items:center;gap:.7rem;flex-wrap:wrap;padding:.8rem;border:1px solid var(--border);border-radius:10px;background:rgba(255,255,255,.02)';

  const update = (perm) => {
    if (perm === 'granted') {
      wrap.innerHTML = `
        <span style="font-size:1.1rem">🔔</span>
        <span style="flex:1">
          <strong style="font-size:.9rem">Notificaciones activadas</strong><br>
          <small style="color:var(--muted)">Te avisaré cuando se registre un partido.</small>
        </span>
        <span class="badge win">✓ Activo</span>`;
    } else if (perm === 'denied') {
      wrap.innerHTML = `
        <span style="font-size:1.1rem">🔕</span>
        <span style="flex:1">
          <strong style="font-size:.9rem">Notificaciones bloqueadas</strong><br>
          <small style="color:var(--muted)">Actívalas desde la configuración del navegador.</small>
        </span>
        <span class="badge danger">Bloqueado</span>`;
    } else {
      wrap.innerHTML = `
        <span style="font-size:1.1rem">🔔</span>
        <span style="flex:1">
          <strong style="font-size:.9rem">Activar notificaciones</strong><br>
          <small style="color:var(--muted)">Recibe un aviso cuando se registre un partido.</small>
        </span>
        <button class="btn small" id="btn-activar-push">Activar</button>`;

      wrap.querySelector('#btn-activar-push')?.addEventListener('click', async () => {
        const result = await requestPermission();
        update(result);
      });
    }
  };

  update(status);
  container.appendChild(wrap);
}
