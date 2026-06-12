// ============================================================
//  LigaPublicaView.jsx — Vista pública de liga (React)
//  Aplica el diseño personalizado configurado por el organizador
// ============================================================
import { useState, useEffect } from 'react';
import { formatFecha } from '../lib/ui.js';
import { sb } from '../lib/supabase.js';
import PlayoffsPublico from './PlayoffsPublico.jsx';

// ── Aplica fuente personalizada al DOM ───────────────────────
function useDiseno(diseno) {
  useEffect(() => {
    if (!diseno || Object.keys(diseno).length === 0) return;
    if (diseno.fuente && diseno.fuente !== 'Inter') {
      const id = 'gf-custom';
      if (!document.getElementById(id)) {
        const link = document.createElement('link');
        link.id   = id;
        link.rel  = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(diseno.fuente)}:wght@400;600;700;900&display=swap`;
        document.head.appendChild(link);
      }
      document.body.style.fontFamily = `'${diseno.fuente}', sans-serif`;
    }
    return () => { document.body.style.fontFamily = ''; };
  }, [diseno]);
}

// ── Fondo de página completo (imagen o color + overlay) ──────
function FondoPagina({ diseno }) {
  const d = diseno || {};
  const img      = d.paginaFondoUrl || '';
  const overlay  = (d.paginaOverlay ?? 55) / 100;
  const fijo     = d.paginaFondoFijo !== false;

  return (
    <div aria-hidden="true" style={{
      position: fijo ? 'fixed' : 'absolute',
      inset: 0, zIndex: -1,
      background: img ? `url(${img}) center/cover no-repeat` : (d.paginaFondoColor || '#080f1e'),
    }}>
      {img && (
        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlay})` }} />
      )}
    </div>
  );
}

// ── Header personalizado ────────────────────────────────────
function HeaderPublico({ liga, diseno }) {
  const d      = diseno || {};
  const logo   = d.logoUrl   || '';
  const nombre = d.nombrePersonal?.trim() || liga.nombre;
  const transparente = d.headerTransparente !== false;

  return (
    <div style={{
      background: transparente ? 'transparent' : (d.colorHeaderFondo || '#080f1e'),
      padding: '1.6rem 1.4rem',
      position: 'relative',
    }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '1rem', maxWidth: 880, margin: '0 auto', justifyContent: 'center', textAlign: 'center', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexDirection: 'row' }}>
          {d.mostrarLogo !== false && (
            logo
              ? <img src={logo} alt="logo" style={{ width: 56, height: 56, objectFit: 'contain', borderRadius: 10, background: 'rgba(255,255,255,.08)', padding: 4, flexShrink: 0 }} />
              : <span style={{ fontSize: '2.5rem', flexShrink: 0 }}>🏐</span>
          )}
          <div style={{ textAlign: 'left' }}>
            {d.mostrarNombre !== false && (
              <h1 style={{
                margin: 0, fontWeight: 900, fontSize: '1.4rem', letterSpacing: '-.03em',
                color: d.colorHeaderTexto || '#fff',
                fontFamily: d.fuente && d.fuente !== 'Inter' ? `'${d.fuente}', sans-serif` : 'inherit',
                lineHeight: 1.2,
              }}>
                {nombre}
              </h1>
            )}
            {d.slogan && (
              <div style={{ fontSize: '.8rem', color: (d.colorHeaderTexto || '#fff') + 'bb', marginTop: '.15rem' }}>
                {d.slogan}
              </div>
            )}
            {d.mostrarCodigo !== false && (
              <code style={{
                display: 'block', fontSize: '.72rem', marginTop: '.25rem',
                color: d.colorPrimario || 'var(--accent)',
                fontFamily: 'monospace', letterSpacing: '.06em',
              }}>
                {liga.alias || liga.codigo}
              </code>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tab Nav ──────────────────────────────────────────────────
function TabNav({ tabs, activeTab, onTabChange, diseno }) {
  const d = diseno || {};
  const transparente = d.tabsTransparente !== false;
  return (
    <nav className="tab-nav" style={{
      justifyContent: 'center',
      background: transparente ? 'transparent' : (d.colorTabFondo || undefined),
      boxShadow: transparente ? 'none' : undefined,
    }}>
      {tabs.map(tab => {
        const esActivo = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            className={esActivo ? 'active' : ''}
            onClick={() => onTabChange(tab.id)}
            style={esActivo
              ? {
                  background: d.colorTabActivo     || undefined,
                  color:      d.colorTabActivoTexto || undefined,
                }
              : {
                  color: d.colorTabTexto || undefined,
                }
            }
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

// ── Tabla de posiciones ──────────────────────────────────────
function TablaPublica({ equipos = [], partidos = [], cfg = {}, diseno = {} }) {
  const usarPts   = cfg.usarPuntos  !== false;
  const usarSets  = cfg.usarSets    !== false;
  const mostrarDS = usarSets && cfg.mostrarColDifSets !== false;
  const tabla     = calcularTabla(equipos, partidos, cfg);

  const d = diseno;
  // tablaTransparencia: 0 = tarjeta sólida, 100 = completamente transparente (solo fondo de página)
  const transp = d.tablaTransparencia ?? 0;
  const alpha  = Math.round((100 - transp) * 2.55).toString(16).padStart(2, '0');
  const tablaFondo = d.colorTablaFondo      ? (d.colorTablaFondo      + alpha) : undefined;
  const encabFondo = d.colorTablaEncabezado ? (d.colorTablaEncabezado + alpha) : undefined;
  const colorTexto       = d.colorTablaTexto       || undefined;
  const colorTextoMuted  = d.colorTablaTextoMuted  || undefined;
  const colorPrimario    = d.colorPrimario          || undefined;
  const colorVictoria    = d.colorVictoria          || undefined;
  const colorDerrota     = d.colorDerrota           || undefined;
  const usaBlur = transp > 0 && transp < 100;

  if (!tabla.length) return <p className="empty">Aún no hay equipos registrados.</p>;

  return (
    <div className="tabla-wrap" style={{ background: 'transparent' }}>
      <table className="tabla-pos" style={{
        background: tablaFondo,
        backdropFilter: usaBlur ? 'blur(10px)' : undefined,
        WebkitBackdropFilter: usaBlur ? 'blur(10px)' : undefined,
        boxShadow: transp < 100 ? '0 8px 32px rgba(0,0,0,.35)' : undefined,
      }}>
        <thead style={encabFondo ? { background: encabFondo } : {}}>
          <tr>
            <th style={colorTextoMuted ? { color: colorTextoMuted } : {}}>#</th>
            <th style={colorTextoMuted ? { color: colorTextoMuted } : {}}>Equipo</th>
            <th style={colorTextoMuted ? { color: colorTextoMuted } : {}}>PJ</th>
            <th style={colorTextoMuted ? { color: colorTextoMuted } : {}}>PG</th>
            <th style={colorTextoMuted ? { color: colorTextoMuted } : {}}>PP</th>
            {usarSets  && <><th style={colorTextoMuted ? { color: colorTextoMuted } : {}}>SG</th><th style={colorTextoMuted ? { color: colorTextoMuted } : {}}>SP</th></>}
            {mostrarDS && <th style={colorTextoMuted ? { color: colorTextoMuted } : {}}>DS</th>}
            {usarPts   && <th style={colorTextoMuted ? { color: colorTextoMuted } : {}}>PTS</th>}
          </tr>
        </thead>
        <tbody>
          {tabla.map((r, i) => {
            const ds    = r.sg - r.sp;
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
            return (
              <tr key={r.equipo} className={i < 3 ? 'top-row' : ''}
                style={i === 0 && colorPrimario ? { background: colorPrimario + '18' } : {}}>
                <td style={colorTexto ? { color: colorTexto } : {}}>{medal || i + 1}</td>
                <td style={colorTexto ? { color: colorTexto } : {}}><span className="team-name">{r.equipo}</span></td>
                <td style={colorTextoMuted ? { color: colorTextoMuted } : {}}>{r.pj}</td>
                <td className="green" style={colorVictoria ? { color: colorVictoria } : {}}>{r.pg}</td>
                <td className="red"   style={colorDerrota  ? { color: colorDerrota  } : {}}>{r.pp}</td>
                {usarSets && (
                  <>
                    <td style={colorTextoMuted ? { color: colorTextoMuted } : {}}>{r.sg}</td>
                    <td style={colorTextoMuted ? { color: colorTextoMuted } : {}}>{r.sp}</td>
                  </>
                )}
                {mostrarDS && (
                  <td className={ds > 0 ? 'green' : ds < 0 ? 'red' : ''}
                    style={ds > 0 && colorVictoria ? { color: colorVictoria } : ds < 0 && colorDerrota ? { color: colorDerrota } : {}}>
                    {ds > 0 ? '+' : ''}{ds}
                  </td>
                )}
                {usarPts && (
                  <td className="pts-cell" style={colorPrimario ? { color: colorPrimario } : {}}>{r.pts}</td>
                )}
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
              <span className="fixture-vs">
                {usarSets ? `${p.sets_a}:${p.sets_b}` : p.ganador === 'A' ? 'G' : 'P'}
              </span>
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

// ── Programación ─────────────────────────────────────────────
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
const MAX_PALABRAS = 200;
function contarPalabras(t) { return t.trim().split(/\s+/).filter(Boolean).length; }

function FormQueja({ ligaId, onEnviado }) {
  const [autor, setAutor]             = useState('');
  const [equipo, setEquipo]           = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [mensaje, setMensaje]         = useState('');
  const [enviando, setEnviando]       = useState(false);
  const [error, setError]             = useState('');

  const enviar = async e => {
    e.preventDefault();
    if (!descripcion.trim()) { setError('La descripción es obligatoria.'); return; }
    if (!mensaje.trim())     { setError('El detalle es obligatorio.'); return; }
    setError(''); setEnviando(true);
    try {
      const { error: err } = await sb.from('comentarios').insert({
        league_id: ligaId, tipo: 'queja',
        autor: autor.trim() || 'Anónimo',
        equipo: equipo.trim() || null,
        descripcion: descripcion.trim(),
        mensaje: mensaje.trim(),
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
        <input type="text" maxLength={120} required placeholder="Resumen breve"
          value={descripcion} onChange={e => setDescripcion(e.target.value)} />
      </div>
      <div className="form-group" style={{ marginBottom: '.8rem' }}>
        <label style={{ fontSize: '.82rem', color: 'var(--muted)', fontWeight: 600 }}>Detalle *</label>
        <textarea rows={3} maxLength={1000} required placeholder="Explica con detalle qué sucedió…"
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
  const palabras = contarPalabras(mensaje);
  const excede   = palabras > MAX_PALABRAS;

  const enviar = async e => {
    e.preventDefault();
    if (!mensaje.trim()) { setError('Escribe tu sugerencia.'); return; }
    if (excede) { setError(`Máximo ${MAX_PALABRAS} palabras.`); return; }
    setError(''); setEnviando(true);
    try {
      const { error: err } = await sb.from('comentarios').insert({
        league_id: ligaId, tipo: 'sugerencia',
        autor: autor.trim() || 'Anónimo',
        mensaje: mensaje.trim(),
      });
      if (err) throw err;
      setAutor(''); setMensaje(''); onEnviado();
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
          <span className={excede ? 'red' : 'muted'} style={{ fontWeight: 400 }}>
            {palabras}/{MAX_PALABRAS} palabras
          </span>
        </label>
        <textarea rows={4} required placeholder="Escribe aquí tu sugerencia…"
          value={mensaje} onChange={e => setMensaje(e.target.value)}
          style={{ width: '100%', padding: '.5rem .75rem', borderRadius: 9, border: `1px solid ${excede ? 'var(--red)' : 'var(--border)'}`, background: 'var(--bg)', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit', fontSize: 'inherit' }} />
      </div>
      {error && <div className="auth-error" style={{ marginBottom: '.6rem' }}>{error}</div>}
      <button type="submit" className="btn" disabled={enviando || excede}>
        {enviando ? 'Enviando…' : 'Enviar sugerencia'}
      </button>
    </form>
  );
}

function Comentarios({ ligaId }) {
  const [tab,     setTab]     = useState('queja');
  const [enviado, setEnviado] = useState(false);
  const handleEnviado = () => { setEnviado(true); setTimeout(() => setEnviado(false), 3500); };

  return (
    <>
      {enviado && (
        <div className="auth-success" style={{ marginBottom: '1rem' }}>
          ✓ ¡Enviado! El organizador lo recibirá pronto.
        </div>
      )}
      <div style={{ display: 'flex', gap: '.4rem', marginBottom: '1rem', background: 'var(--bg)', borderRadius: 10, padding: '.3rem', border: '1px solid var(--border)' }}>
        <button
          style={{ flex: 1, padding: '.45rem', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer', background: tab === 'queja' ? 'var(--red)' : 'transparent', color: tab === 'queja' ? '#fff' : 'var(--muted)', transition: 'all .15s' }}
          onClick={() => setTab('queja')}
        >
          🔴 Queja
        </button>
        <button
          style={{ flex: 1, padding: '.45rem', borderRadius: 8, border: 'none', fontWeight: 600, cursor: 'pointer', background: tab === 'sugerencia' ? 'var(--accent)' : 'transparent', color: tab === 'sugerencia' ? '#0f172a' : 'var(--muted)', transition: 'all .15s' }}
          onClick={() => setTab('sugerencia')}
        >
          💡 Sugerencia
        </button>
      </div>
      {tab === 'queja' && (
        <div className="card">
          <p className="card-subtitle">🔴 Enviar queja</p>
          <p className="muted" style={{ fontSize: '.82rem', marginBottom: '1rem' }}>Reporta un problema específico.</p>
          <FormQueja ligaId={ligaId} onEnviado={handleEnviado} />
        </div>
      )}
      {tab === 'sugerencia' && (
        <div className="card">
          <p className="card-subtitle">💡 Enviar sugerencia</p>
          <p className="muted" style={{ fontSize: '.82rem', marginBottom: '1rem' }}>Comparte una idea para mejorar la liga.</p>
          <FormSugerencia ligaId={ligaId} onEnviado={handleEnviado} />
        </div>
      )}
    </>
  );
}

// ── Tabs según bracket y permisos ───────────────────────────
function buildTabs(bracket, permitirComentarios) {
  const hayPlayoffs = bracket && Array.isArray(bracket.rondas) && bracket.rondas.length > 0;
  const base = [
    { id: 'tabla',        label: 'Tabla'        },
    { id: 'programacion', label: 'Programación' },
    { id: 'resultados',   label: 'Resultados'   },
  ];
  if (permitirComentarios) base.push({ id: 'comentarios', label: '💬 Comentarios' });
  const tabPlayoffs = { id: 'playoffs', label: '🏆 Playoffs' };
  return hayPlayoffs ? [tabPlayoffs, ...base] : [...base, tabPlayoffs];
}

// ════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function LigaPublicaView({ liga, equipos = [], partidos = [], bracket = null, opts = {} }) {
  const cfg                 = liga.config || {};
  const diseno              = cfg.diseno  || {};
  const permitirComentarios = cfg.permitirComentarios !== false;
  const tabs                = buildTabs(bracket, permitirComentarios);
  const [activeTab, setActiveTab] = useState('tabla');
  const tieneDiseno = Object.keys(diseno).length > 0;

  useDiseno(tieneDiseno ? diseno : null);

  useEffect(() => {
    const ids = tabs.map(t => t.id);
    if (!ids.includes(activeTab)) setActiveTab('tabla');
  }, [tabs, activeTab]);

  return (
    <>
      {/* Fondo de página completo — imagen o color */}
      {tieneDiseno && <FondoPagina diseno={diseno} />}

      {/* Header personalizado — siempre si hay diseño */}
      {tieneDiseno && <HeaderPublico liga={liga} diseno={diseno} />}

      <TabNav
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        diseno={tieneDiseno ? diseno : {}}
      />

      {/* Identificador — solo si NO hay diseño personalizado */}
      {!tieneDiseno && (
        <div style={{ textAlign: 'center', margin: '.5rem 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
          <code className="codigo-chip" style={{ fontSize: '.85rem' }}>
            {liga.alias || liga.codigo}
          </code>
          {liga.alias && (
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
      )}

      {opts.offline && tieneDiseno && (
        <div style={{ textAlign: 'center', marginBottom: '.5rem' }}>
          <span className="badge pending">📵 Offline · {formatFechaRelativa(opts.savedAt)}</span>
        </div>
      )}

      <section className="section" style={tieneDiseno ? { background: 'transparent' } : {}}>
        {activeTab === 'playoffs'     && <PlayoffsPublico bracket={bracket} cfg={cfg} />}
        {activeTab === 'tabla'        && <TablaPublica    equipos={equipos} partidos={partidos} cfg={cfg} diseno={diseno} />}
        {activeTab === 'programacion' && <Programacion />}
        {activeTab === 'resultados'   && <Resultados      partidos={partidos} cfg={cfg} />}
        {activeTab === 'comentarios'  && <Comentarios     ligaId={liga.id} />}
      </section>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function calcularTabla(equipos, partidos, cfg) {
  if (!Array.isArray(equipos))  equipos  = [];
  if (!Array.isArray(partidos)) partidos = [];
  const usarPts  = cfg.usarPuntos !== false;
  const usarSets = cfg.usarSets   !== false;
  const ptsV = cfg.ptsVictoria ?? 2;
  const ptsB = cfg.ptsBono     ?? 1;
  const ptsD = cfg.ptsDerota   ?? 0;
  const t = {};
  equipos.forEach(e => { t[e.nombre] = { equipo: e.nombre, pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, pts: 0 }; });
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
