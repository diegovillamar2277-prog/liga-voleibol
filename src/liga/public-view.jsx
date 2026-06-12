// ============================================================
//  public-view.jsx — Vista pública (React)
// ============================================================
import { createRoot } from 'react-dom/client';
import { useState, useEffect, useCallback } from 'react';
import { saveSnapshot, loadSnapshot, isOnline, setupOfflineBanner } from '../lib/offline.js';
import { sb } from '../lib/supabase.js';
import LigaPublicaView from '../components/LigaPublicaView.jsx';

let _root = null;
let _container = null;

// EXPORTADO — necesario para cleanup() en main.jsx
export function unmountPublicView() {
  if (_root) { _root.unmount(); _root = null; _container = null; }
}

export function renderPublicView(container, codigoInicial = '') {
  if (_root && _container !== container) { _root.unmount(); _root = null; }
  if (!_root) { _root = createRoot(container); _container = container; }
  setupOfflineBanner();
  _root.render(<PublicViewApp codigoInicial={codigoInicial} />);
}

function PublicViewApp({ codigoInicial }) {
  const [estado, setEstado] = useState(codigoInicial ? 'cargando' : 'buscador');
  const [datos,  setDatos]  = useState(null);
  const [codigo, setCodigo] = useState('');
  const [error,  setError]  = useState('');

  const irALogin = () =>
    document.dispatchEvent(new CustomEvent('nav', { detail: { page: 'login' } }));

  const cargarLiga = useCallback(async (q) => {
    const trimmed = q.trim();
    if (!trimmed) { setError('Escribe el código'); return; }
    setEstado('cargando'); setError('');
    try {
      const { data: liga, error: err } = await sb
        .from('leagues').select('*')
        .or(`alias.eq.${trimmed.toLowerCase()},codigo.eq.${trimmed.toUpperCase()}`)
        .eq('activa', true).single();
      if (err || !liga) throw new Error('no encontrada');

      const [{ data: equipos }, { data: partidos }, { data: playoffRow }] = await Promise.all([
        sb.from('teams').select('*').eq('league_id', liga.id).order('created_at'),
        sb.from('matches').select('*').eq('league_id', liga.id).order('fecha'),
        sb.from('playoffs').select('data').eq('league_id', liga.id).maybeSingle(),
      ]);
      const bracket = playoffRow?.data || null;

      try {
        await saveSnapshot(liga.id, { liga, equipos: equipos || [], partidos: partidos || [], bracket });
        await saveSnapshot(`codigo:${trimmed.toLowerCase()}`, { ligaId: liga.id, liga, equipos: equipos || [], partidos: partidos || [], bracket });
      } catch (_) {}

      setDatos({ liga, equipos: equipos || [], partidos: partidos || [], bracket, opts: {} });
      setEstado('liga');
    } catch {
      if (!isOnline()) {
        const snap = await loadSnapshot(`codigo:${trimmed.toLowerCase()}`);
        if (snap?.liga) {
          setDatos({ liga: snap.liga, equipos: snap.equipos || [], partidos: snap.partidos || [], bracket: snap.bracket || null, opts: { offline: true, savedAt: snap.savedAt } });
          setEstado('liga'); return;
        }
      }
      setError(isOnline() ? 'Código o nombre no válido. Verifica e intenta de nuevo.' : 'Sin conexión y sin datos guardados para esta liga.');
      setEstado('buscador');
    }
  }, []);

  useEffect(() => { if (codigoInicial) cargarLiga(codigoInicial); }, [codigoInicial, cargarLiga]);

  // La liga tiene diseño personalizado si tiene al menos un campo configurado
  const tieneDiseno = !!(datos?.liga?.config?.diseno && Object.keys(datos.liga.config.diseno).length > 0);

  return (
    <div className="app-shell" style={tieneDiseno ? { background: 'transparent' } : {}}>
      {tieneDiseno ? (
        // Liga con diseño personalizado: LigaPublicaView ya muestra logo y nombre
        // en su propio header, así que aquí solo dejamos un botón flotante y
        // transparente para no duplicar el nombre de la liga.
        <header className="topbar" style={{
          background: 'transparent', border: 'none', boxShadow: 'none',
          position: 'absolute', top: 0, right: 0, left: 'auto', width: 'auto',
          padding: '.8rem 1rem', zIndex: 5,
        }}>
          <div className="topbar-right">
            <button className="btn secondary small" onClick={irALogin}>Iniciar sesión</button>
          </div>
        </header>
      ) : (
        <header className="topbar">
          <div className="topbar-left">
            <span className="topbar-logo">🏐</span>
            <span className="topbar-title">{datos?.liga?.nombre || 'Liga Voleibol'}</span>
          </div>
          <div className="topbar-right">
            <button className="btn secondary small" onClick={irALogin}>Iniciar sesión</button>
          </div>
        </header>
      )}
      {estado === 'cargando' && <div className="loading-spinner" style={{ margin: '4rem auto' }} />}
      {estado === 'buscador' && <Buscador codigo={codigo} onChange={setCodigo} onBuscar={() => cargarLiga(codigo)} error={error} />}
      {estado === 'liga' && datos && (
        <LigaPublicaView liga={datos.liga} equipos={datos.equipos} partidos={datos.partidos} bracket={datos.bracket} opts={datos.opts} />
      )}
    </div>
  );
}

function Buscador({ codigo, onChange, onBuscar, error }) {
  return (
    <div className="empty-state" style={{ maxWidth: 440, margin: '4rem auto', padding: '2rem' }}>
      <div className="empty-icon">🏐</div>
      <h2>Ver mi liga</h2>
      <p className="muted" style={{ marginBottom: '1.5rem' }}>Ingresa el código o nombre corto de tu liga.</p>
      <div style={{ display: 'flex', gap: '.6rem' }}>
        <input type="text" placeholder="código o nombre-corto" maxLength={20} value={codigo}
          onChange={e => onChange(e.target.value)} onKeyDown={e => e.key === 'Enter' && onBuscar()}
          style={{ flex: 1, fontSize: '1rem', padding: '.65rem 1rem', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }} />
        <button className="btn" onClick={onBuscar}>Entrar</button>
      </div>
      {error && <div className="auth-error" style={{ marginTop: '.6rem' }}>{error}</div>}
    </div>
  );
}
