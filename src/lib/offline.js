// ============================================================
//  offline.js — Caché offline con IndexedDB
//
//  Guarda snapshot de equipos, partidos y config de la liga
//  para que la vista pública funcione sin internet.
//
//  API pública:
//    saveSnapshot(ligaId, { liga, equipos, partidos })
//    loadSnapshot(ligaId) → { liga, equipos, partidos, savedAt } | null
//    clearSnapshot(ligaId)
//    isOnline() → boolean
//    onConnectivityChange(callback)  — llama callback(isOnline) al cambiar
// ============================================================

const DB_NAME    = 'liga-voleibol-offline';
const DB_VERSION = 1;
const STORE      = 'snapshots';

// ── Abrir DB ─────────────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'ligaId' });
      }
    };
    req.onsuccess  = e => resolve(e.target.result);
    req.onerror    = e => reject(e.target.error);
  });
}

// ── Guardar snapshot ─────────────────────────────────────────
export async function saveSnapshot(ligaId, { liga, equipos, partidos }) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.put({
        ligaId,
        liga,
        equipos,
        partidos,
        savedAt: new Date().toISOString()
      });
      tx.oncomplete = () => resolve(true);
      tx.onerror    = e => reject(e.target.error);
    });
  } catch (err) {
    console.warn('[offline] No se pudo guardar snapshot:', err);
    return false;
  }
}

// ── Leer snapshot ─────────────────────────────────────────────
export async function loadSnapshot(ligaId) {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx    = db.transaction(STORE, 'readonly');
      const store = tx.objectStore(STORE);
      const req   = store.get(ligaId);
      req.onsuccess = e => resolve(e.target.result || null);
      req.onerror   = e => reject(e.target.error);
    });
  } catch (err) {
    console.warn('[offline] No se pudo leer snapshot:', err);
    return null;
  }
}

// ── Eliminar snapshot ─────────────────────────────────────────
export async function clearSnapshot(ligaId) {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx    = db.transaction(STORE, 'readwrite');
      const store = tx.objectStore(STORE);
      store.delete(ligaId);
      tx.oncomplete = () => resolve(true);
    });
  } catch (_) { return false; }
}

// ── Estado de conexión ────────────────────────────────────────
export function isOnline() {
  return navigator.onLine;
}

// Llama callback(true/false) cada vez que cambia la conectividad
export function onConnectivityChange(callback) {
  window.addEventListener('online',  () => callback(true));
  window.addEventListener('offline', () => callback(false));
}

// ── Banner offline (UI helper) ────────────────────────────────
// Muestra/oculta un banner discreto en la parte superior
export function setupOfflineBanner() {
  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.style.cssText = `
      display:none; position:fixed; top:0; left:0; right:0; z-index:10000;
      background:#1e293b; border-bottom:2px solid #f59e0b;
      padding:.45rem 1rem; text-align:center;
      font-size:.82rem; font-weight:600; color:#f59e0b;
    `;
    banner.textContent = '📵 Sin conexión — mostrando datos guardados';
    document.body.prepend(banner);
  }

  const update = online => {
    banner.style.display = online ? 'none' : 'block';
  };

  update(isOnline());
  onConnectivityChange(update);
}
