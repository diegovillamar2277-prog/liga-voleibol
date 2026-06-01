// ============================================================
//  public-view.jsx — Vista pública con soporte offline
// ============================================================
import { createRoot } from 'react-dom/client';
import { saveSnapshot, loadSnapshot, isOnline, setupOfflineBanner } from '../lib/offline.js';
import { sb } from '../lib/supabase.js';
import LigaPublicaView from '../components/LigaPublicaView.jsx';

let _reactRoot = null;

export async function renderPublicView(container, codigoInicial = '') {
  container.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <span class="topbar-logo">🏐</span>
          <span class="topbar-title" id="pub-liga-nombre">Liga Voleibol</span>
        </div>
        <div class="topbar-right">
          <button class="btn secondary small" id="btn-ir-login">Iniciar sesión</button>
        </div>
      </header>
      <div id="pub-body">
        ${codigoInicial
          ? '<div class="loading-spinner" style="margin:3rem auto"></div>'
          : renderBuscador()}
      </div>
    </div>`;

  _reactRoot = null;
  setupOfflineBanner();

  container.querySelector('#btn-ir-login').onclick = () =>
    document.dispatchEvent(new CustomEvent('nav', { detail: { page: 'login' } }));

  const pubBody = container.querySelector('#pub-body');
  if (pubBody && !codigoInicial) {
    bindBuscadorEvents(pubBody);
  }

  if (codigoInicial) {
    await cargarLiga(codigoInicial);
  }
}

function renderBuscador() {
  return `
    <div class="empty-state" style="max-width:440px;margin:4rem auto;padding:2rem">
      <div class="empty-icon">🏐</div>
      <h2>Ver mi liga</h2>
      <p class="muted" style="margin-bottom:1.5rem">
        Ingresa el código o nombre corto de tu liga.
      </p>
      <div style="display:flex;gap:.6rem">
        <input type="text" id="input-codigo"
          placeholder="Ej: lachona o QMT-X59"
          maxlength="20"
          style="flex:1;font-size:1rem;padding:.65rem 1rem;border-radius:10px;
          border:1px solid var(--border);background:var(--bg);color:var(--text)">
        <button class="btn" id="btn-buscar">Entrar</button>
      </div>
      <div id="buscar-error" class="auth-error" style="display:none;margin-top:.6rem"></div>
    </div>`;
}

function bindBuscadorEvents(el) {
  const btn   = el.querySelector('#btn-buscar');
  const input = el.querySelector('#input-codigo');
  if (btn)   btn.addEventListener('click', () => cargarLiga(input?.value || ''));
  if (input) input.addEventListener('keydown', e => {
    if (e.key === 'Enter') cargarLiga(input.value || '');
  });
}

async function cargarLiga(codigo) {
  const el = document.getElementById('pub-body');
  if (!el) return;

  try {
    const q = codigo.trim();
    const { data: liga, error } = await sb
      .from('leagues')
      .select('*')
      .or(`alias.eq.${q.toLowerCase()},codigo.eq.${q.toUpperCase()}`)
      .eq('activa', true)
      .single();

    if (error || !liga) throw new Error('no encontrada');

    const [
      { data: equipos },
      { data: partidos },
      { data: playoffRow },
    ] = await Promise.all([
      sb.from('teams').select('*').eq('league_id', liga.id).order('created_at'),
      sb.from('matches').select('*').eq('league_id', liga.id).order('fecha'),
      sb.from('playoffs').select('data').eq('league_id', liga.id).maybeSingle(),
    ]);

    const bracket = playoffRow?.data || null;

    await saveSnapshot(liga.id, { liga, equipos: equipos || [], partidos: partidos || [], bracket });
    await saveSnapshot(`codigo:${q.toLowerCase()}`, { ligaId: liga.id, liga, equipos: equipos || [], partidos: partidos || [], bracket });

    const nombreEl = document.querySelector('#pub-liga-nombre');
    if (nombreEl) nombreEl.textContent = liga.nombre;

    renderLigaPublica(el, liga, equipos || [], partidos || [], bracket);

  } catch (err) {
    if (!isOnline()) {
      const snap = await loadSnapshot(`codigo:${codigo.trim().toLowerCase()}`);
      if (snap?.liga) {
        const nombreEl = document.querySelector('#pub-liga-nombre');
        if (nombreEl) nombreEl.textContent = snap.liga.nombre;
        renderLigaPublica(el, snap.liga, snap.equipos || [], snap.partidos || [], snap.bracket || null, {
          offline: true,
          savedAt: snap.savedAt,
        });
        return;
      }
    }

    el.innerHTML = renderBuscador();
    const errEl = document.getElementById('buscar-error');
    if (errEl) {
      errEl.textContent = isOnline()
        ? 'Código o nombre no válido. Verifica e intenta de nuevo.'
        : 'Sin conexión y sin datos guardados para esta liga.';
      errEl.style.display = 'block';
    }
    bindBuscadorEvents(el);
  }
}

function renderLigaPublica(el, liga, equipos, partidos, bracket, opts = {}) {
  const nombreEl = document.querySelector('#pub-liga-nombre');
  if (nombreEl) nombreEl.textContent = liga.nombre;

  if (!_reactRoot) _reactRoot = createRoot(el);
  _reactRoot.render(
    <LigaPublicaView
      liga={liga}
      equipos={equipos}
      partidos={partidos}
      bracket={bracket}
      opts={opts}
    />
  );
}
