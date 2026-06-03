// ============================================================
//  LigaPublicaView.jsx — Vista pública de liga (React)
// ============================================================
import { useState, useEffect } from 'react';
import { formatFecha } from '../lib/ui.js';
import { sb } from '../lib/supabase.js';
import PlayoffsPublico from './PlayoffsPublico.jsx';

function TabNav({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="tab-nav">
      {tabs.map(tab => (
        <button key={tab.id} className={activeTab === tab.id ? 'active' : ''} onClick={() => onTabChange(tab.id)}>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

// ── Tabla de posiciones ──────────────────────────────────────
function TablaPublica({ equipos = [], partidos = [], cfg = {} }) {
  const usarPts   = cfg.usarPuntos  !== false;
  const usarSets  = cfg.usarSets    !== false;
  const mostrarDS = usarSets && cfg.mostrarColDifSets !== false;
  const tabla     = calcularTabla(equipos, partidos, cfg);

  if (!tabla.length) return <p className="empty">Aún no hay equipos registrados.</p>;

  return (
    <div className="tabla-wrap">
      <table className="tabla-pos">
        <thead>
          <tr>
            <th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th>
            {usarSets  && <><th>SG</th><th>SP</th></>}
            {mostrarDS && <th>DS</th>}
            {usarPts   && <th>PTS</th>}
          </tr>
        </thead>
        <tbody>
          {tabla.map((r, i) => {
            const ds    = r.sg - r.sp;
            const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
            return (
              <tr key={r.equipo} className={i < 3 ? 'top-row' : ''}>
                <td>{medal || i + 1}</td>
                <td><span className="team-name">{r.equipo}</span></td>
                <td>{r.pj}</td><td className="green">{r.pg}</td><td className="red">{r.pp}</td>
                {usarSets  && <><td>{r.sg}</td><td>{r.sp}</td></>}
                {mostrarDS && <td className={ds>0?'green':ds<0?'red':''}>{ds>0?'+':''}{ds}</td>}
                {usarPts   && <td className="pts-cell">{r.pts}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Resultados ───────────────────────────────────────────────
function Resultados({ partidos = [], cfg = {} }) {
  const usarSets = cfg.usarSets !== false;
  const norm = partidos
    .filter(p => p.jugado && !p.es_playoff)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  if (!norm.length) return <p className="empty">No hay partidos registrados aún.</p>;

  return (
    <div className="fixture-list">
      {norm.map(p => {
        const ganN = p.ganador === 'A' ? p.equipo_a : p.equipo_b;
        return (
          <div key={p.id} className="fixture-item jugado">
            <span className="badge done">V{p.vuelta}</span>
            <div className="fixture-teams">
              <span className={p.ganador === 'A' ? 'team-win' : ''}>{p.equipo_a}</span>
              <span className="fixture-vs">{usarSets ? `${p.sets_a}:${p.sets_b}` : p.ganador === 'A' ? 'G' : 'P'}</span>
              <span className={p.ganador === 'B' ? 'team-win' : ''}>{p.equipo_b}</span>
            </div>
            <span className="badge win">🏆 {ganN}</span>
            {p.fecha && <span className="fixture-date">{formatFecha(p.fecha)}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Programación (en mantenimiento) ─────────────────────────
function Programacion() {
  return (
    <div className="empty-state" style={{ padding: '3rem 1rem' }}>
      <div className="empty-icon">🔧</div>
      <h2>Programación</h2>
      <p className="muted" style={{ marginTop: '.5rem' }}>
        Esta sección está en mantenimiento.<br />
        Pronto podrás ver los próximos partidos aquí.
      </p>
      <span className="badge pending" style={{ marginTop: '1rem', fontSize: '.82rem', padding: '.35rem .8rem' }}>
        En mantenimiento
      </span>
    </div>
  );
}

// ── Quejas y Sugerencias ─────────────────────────────────────
const MAX_PALABRAS_SUGERENCIA = 200;

function contarPalabras(texto) {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function FormQueja({ ligaId, onEnviado }) {
  const [autor,       setAutor]       = useState('');
  const [equipo,      setEquipo]      = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [mensaje,     setMensaje]     = useState('');
  const [enviando,    setEnviando]    = useState(false);
  const [error,       setError]       = useState('');

  const enviar = async e => {
    e.preventDefault();
    if (!descripcion.trim()) { setError('La descripción es obligatoria.'); return; }
    if (!mensaje.trim())     { setError('El detalle es obligatorio.'); return; }
    setError(''); setEnviando(true);
    try {
      const { error: err } = await sb.from('comentarios').insert({
        league_id:   ligaId,
        tipo:        'queja',
        autor:       autor.trim() || 'Anónimo',
        equipo:      equipo.trim() || null,
        descripcion: descripcion.trim(),
        mensaje:     mensaje.trim(),
      });
      if (err) throw err;
      setAutor(''); setEquipo(''); setDescripcion(''); setMensaje('');
      onEnviado();
    } catch { setError('No se pudo enviar. Intenta de nuevo.'); }
    finally { setEnviando(false); }
  };

  return (
    <form onSubmit={enviar}>
      <div className="form-row" style={{ marginBottom: '.8rem' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label style={{ fontSize: '.82rem', color: 'var(--muted)', fontWeight: 600 }}>Tu nombre (opcional)</label>
          <input type="text" maxLength={40} placeholder="Anónimo" value={autor} onChange={e => setAutor(e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label style={{ fontSize: '.82rem', color: 'var(--muted)', fontWeight: 600 }}>Equipo involucrado (opcional)</label>
          <input type="text" maxLength={60} placeholder="Nombre del equipo" value={equipo} onChange={e => setEquipo(e.target.value)} />
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: '.8rem' }}>
        <label style={{ fontSize: '.82rem', color: 'var(--muted)', fontWeight: 600 }}>¿Qué pasó? *</label>
        <input type="text" maxLength={120} required placeholder="Resumen breve de la queja"
          value={descripcion} onChange={e => setDescripcion(e.target.value)} />
      </div>
      <div className="form-group" style={{ marginBottom: '.8rem' }}>
        <label style={{ fontSize: '.82rem', color: 'var(--muted)', fontWeight: 600 }}>Detalle *</label>
        <textarea rows={3} maxLength={1000} required placeholder="Explica con detalle qué sucedió, cuándo y dónde…"
          value={mensaje} onChange={e => setMensaje(e.target.value)}
          style={{ width: '100%', padding: '.5rem .75rem', borderRadius: 9, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit', fontSize: 'inherit' }} />
      </div>
      {error && <div className="auth-error" style={{ marginBottom: '.6rem' }}>{error}</div>}
      <button type="submit" className="btn" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar queja'}</button>
    </form>
  );
}

function FormSugerencia({ ligaId, onEnviado }) {
  const [autor,    setAutor]    = useState('');
  const [mensaje,  setMensaje]  = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error,    setError]    = useState('');

  const palabras   = contarPalabras(mensaje);
  const excedePalabras = palabras > MAX_PALABRAS_SUGERENCIA;

  const enviar = async e => {
    e.preventDefault();
    if (!mensaje.trim())  { setError('Escribe tu sugerencia.'); return; }
    if (excedePalabras)   { setError(`Máximo ${MAX_PALABRAS_SUGERENCIA} palabras (tienes ${palabras}).`); return; }
    setError(''); setEnviando(true);
    try {
      const { error: err } = await sb.from('comentarios').insert({
        league_id: ligaId,
        tipo:      'sugerencia',
        autor:     autor.trim() || 'Anónimo',
        mensaje:   mensaje.trim(),
      });
      if (err) throw err;
      setAutor(''); setMensaje('');
      onEnviado();
    } catch { setError('No se pudo enviar. Intenta de nuevo.'); }
    finally { setEnviando(false); }
  };

  return (
    <form onSubmit={enviar}>
      <div className="form-group" style={{ marginBottom: '.8rem' }}>
        <label style={{ fontSize: '.82rem', color: 'var(--muted)', fontWeight: 600 }}>Tu nombre (opcional)</label>
        <input type="text" maxLength={40} placeholder="Anónimo" value={autor} onChange={e => setAutor(e.target.value)} />
      </div>
      <div className="form-group" style={{ marginBottom: '.8rem' }}>
        <label style={{ fontSize: '.82rem', color: 'var(--muted)', fontWeight: 600 }}>
          Tu sugerencia * &nbsp;
          <span className={excedePalabras ? 'red' : 'muted'} style={{ fontWeight: 400 }}>
            {palabras}/{MAX_PALABRAS_SUGERENCIA} palabras
          </span>
        </label>
        <textarea rows={4} required placeholder="Escribe aquí tu sugerencia para mejorar la liga…"
          value={mensaje} onChange={e => setMensaje(e.target.value)}
          style={{ width: '100%', padding: '.5rem .75rem', borderRadius: 9, border: `1px solid ${excedePalabras ? 'var(--red)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit', fontSize: 'inherit' }} />
      </div>
      {error && <div className="auth-error" style={{ marginBottom: '.6rem' }}>{error}</div>}
      <button type="submit" className="btn" disabled={enviando || excedePalabras}>
        {enviando ? 'Enviando…' : 'Enviar sugerencia'}
      </button>
    </form>
  );
}

function Comentarios({ ligaId }) {
  const [tab,     setTab]     = useState('queja');
  const [enviado, setEnviado] = useState(false);

  const handleEnviado = () => {
    setEnviado(true);
    setTimeout(() => setEnviado(false), 3500);
  };

  return (
    <>
      {enviado && (
        <div className="auth-success" style={{ marginBottom: '1rem' }}>
          ✓ ¡Enviado! El organizador lo recibirá pronto.
        </div>
      )}

      {/* Selector queja / sugerencia */}
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem', background: 'var(--bg)', borderRadius: 10, padding: '.3rem', border: '1px solid var(--border)' }}>
        <button
          className={`auth-tab ${tab === 'queja' ? 'active' : ''}`}
          style={{ flex: 1, padding: '.45rem', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer', background: tab === 'queja' ? 'var(--red)' : 'transparent', color: tab === 'queja' ? '#fff' : 'var(--muted)', transition: 'all .15s' }}
          onClick={() => setTab('queja')}
        >
          🔴 Queja
        </button>
        <button
          className={`auth-tab ${tab === 'sugerencia' ? 'active' : ''}`}
          style={{ flex: 1, padding: '.45rem', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer', background: tab === 'sugerencia' ? 'var(--accent)' : 'transparent', color: tab === 'sugerencia' ? '#0f172a' : 'var(--muted)', transition: 'all .15s' }}
          onClick={() => setTab('sugerencia')}
        >
          💡 Sugerencia
        </button>
      </div>

      {tab === 'queja' && (
        <div className="card">
          <p className="card-subtitle">🔴 Enviar queja</p>
          <p className="muted" style={{ fontSize: '.82rem', marginBottom: '1rem' }}>
            Reporta un problema específico. Incluye el mayor detalle posible.
          </p>
          <FormQueja ligaId={ligaId} onEnviado={handleEnviado} />
        </div>
      )}

      {tab === 'sugerencia' && (
        <div className="card">
          <p className="card-subtitle">💡 Enviar sugerencia</p>
          <p className="muted" style={{ fontSize: '.82rem', marginBottom: '1rem' }}>
            Comparte una idea para mejorar la liga. Máximo {MAX_PALABRAS_SUGERENCIA} palabras.
          </p>
          <FormSugerencia ligaId={ligaId} onEnviado={handleEnviado} />
        </div>
      )}
    </>
  );
}

// ── Lógica de tabs: Playoffs primero si hay bracket ──────────
function buildTabs(bracket, permitirComentarios) {
  const hayPlayoffs = bracket && Object.keys(bracket).length > 0;
  const base = [
    { id: 'tabla',        label: 'Tabla'        },
    { id: 'programacion', label: 'Programación' },
    { id: 'resultados',   label: 'Resultados'   },
  ];
  if (permitirComentarios) {
    base.push({ id: 'comentarios', label: '💬 Comentarios' });
  }
  const tabPlayoffs = { id: 'playoffs', label: '🏆 Playoffs' };
  return hayPlayoffs ? [tabPlayoffs, ...base] : [...base, tabPlayoffs];
}

// ── Componente principal ─────────────────────────────────────
export default function LigaPublicaView({ liga, equipos = [], partidos = [], bracket = null, opts = {} }) {
  const cfg               = liga.config || {};
  const permitirComentarios = cfg.permitirComentarios !== false;
  const tabs              = buildTabs(bracket, permitirComentarios);
  const [activeTab, setActiveTab] = useState('tabla');

  // Si playoffs aparece/desaparece y el tab activo ya no está, volver a tabla
  useEffect(() => {
    const ids = tabs.map(t => t.id);
    if (!ids.includes(activeTab)) setActiveTab('tabla');
  }, [bracket, permitirComentarios]);

  const tieneAlias = liga.alias && liga.alias !== liga.codigo;

  return (
    <>
      <TabNav tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Identificador limpio: alias en chip, código crudo en gris */}
      <div style={{ textAlign: 'center', margin: '.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
        <code className="codigo-chip" style={{ fontSize: '.85rem' }}>
          {tieneAlias ? liga.alias : liga.codigo}
        </code>
        {tieneAlias && (
          <span className="muted" style={{ fontSize: '.75rem' }}>{liga.codigo}</span>
        )}
        {liga.temporada && (
          <span className="muted" style={{ fontSize: '.8rem' }}>· {liga.temporada}</span>
        )}
        {opts.offline && (
          <span className="badge pending" title={`Guardado el ${new Date(opts.savedAt).toLocaleString('es-MX')}`}>
            📵 Offline · {formatFechaRelativa(opts.savedAt)}
          </span>
        )}
      </div>

      <section className="section">
        {activeTab === 'playoffs'     && <PlayoffsPublico bracket={bracket} cfg={cfg} />}
        {activeTab === 'tabla'        && <TablaPublica    equipos={equipos} partidos={partidos} cfg={cfg} />}
        {activeTab === 'programacion' && <Programacion />}
        {activeTab === 'resultados'   && <Resultados      partidos={partidos} cfg={cfg} />}
        {activeTab === 'comentarios'  && <Comentarios     ligaId={liga.id} />}
      </section>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function calcularTabla(equipos, partidos, cfg) {
  if (!Array.isArray(equipos)) equipos = [];
  if (!Array.isArray(partidos)) partidos = [];
  const usarPts  = cfg.usarPuntos !== false;
  const usarSets = cfg.usarSets   !== false;
  const ptsV = cfg.ptsVictoria ?? 2;
  const ptsB = cfg.ptsBono     ?? 1;
  const ptsD = cfg.ptsDerota   ?? 0;
  const t = {};
  equipos.forEach(e => { t[e.nombre] = { equipo: e.nombre, pj:0, pg:0, pp:0, sg:0, sp:0, pts:0 }; });
  partidos.filter(p => p.jugado && !p.es_playoff).forEach(p => {
    const a = t[p.equipo_a], b = t[p.equipo_b];
    if (!a || !b) return;
    a.pj++; b.pj++;
    if (usarSets) { a.sg += p.sets_a; a.sp += p.sets_b; b.sg += p.sets_b; b.sp += p.sets_a; }
    if (p.ganador === 'A') {
      a.pg++; b.pp++;
      if (usarPts) { a.pts += ptsV; b.pts += ptsD; if (usarSets && p.sets_b > 0) b.pts += ptsB; }
    } else {
      b.pg++; a.pp++;
      if (usarPts) { b.pts += ptsV; a.pts += ptsD; if (usarSets && p.sets_a > 0) a.pts += ptsB; }
    }
  });
  return Object.values(t).sort((a, b) => {
    if (usarPts && b.pts !== a.pts) return b.pts - a.pts;
    if (b.pg !== a.pg) return b.pg - a.pg;
    if (usarSets) return (b.sg - b.sp) - (a.sg - a.sp);
    return 0;
  });
}

function formatFechaRelativa(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'hace un momento';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}
