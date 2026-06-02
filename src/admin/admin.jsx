// ============================================================
//  admin.jsx — Panel de administrador (React)
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { sb } from '../lib/supabase.js';
import {
  getTodosUsuarios, cambiarRol, desactivarUsuario, activarUsuario,
  getTodasLigas, actualizarLiga, getPeticiones, responderPeticion,
  getMetricas, getMisLigas, crearLiga,
  getLigaById, getEquipos, agregarEquipo, actualizarEquipo, eliminarEquipo,
  getPartidos, guardarPartido, actualizarPartido, eliminarPartido,
} from '../lib/db.js';
import TabPlayoffs from '../liga/TabPlayoffs.jsx';
import { TabFinanzas, TabConfig } from '../liga/liga-dashboard.jsx';
import { toast, formatFecha } from '../lib/ui.js';
import PushToggle from '../components/PushToggle.jsx';

// ── Punto de entrada (llamado desde main.js) ─────────────────
let _root = null;
let _container = null;

export function unmountAdminPanel() {
  if (_root) { _root.unmount(); _root = null; _container = null; }
}

export function renderAdminPanel(container, profile) {
  if (_root && _container !== container) {
    _root.unmount(); _root = null;
  }
  if (!_root) {
    _root = createRoot(container);
    _container = container;
  }
  _root.render(<AdminPanelApp profile={profile} />);
}

// ════════════════════════════════════════════════════════════
//  COMPONENTE RAÍZ
// ════════════════════════════════════════════════════════════
const SECCIONES = [
  { id: 'metricas',   label: '📊 Métricas'   },
  { id: 'ligas',      label: '🏆 Ligas'       },
  { id: 'usuarios',   label: '👤 Usuarios'    },
  { id: 'peticiones', label: '📋 Peticiones'  },
  { id: 'miliga',     label: '🧪 Mi liga'     },
];

function AdminPanelApp({ profile }) {
  const [seccion, setSeccion] = useState('metricas');

  const handleLogout = async () => {
    await sb.auth.signOut();
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">🏐</span>
          <span className="topbar-title">Panel Admin</span>
          <span className={`badge-role ${profile?.role}`}>
            {profile?.role === 'superadmin' ? '⭐ Superadmin' : '🛡 Admin'}
          </span>
        </div>
        <div className="topbar-right">
          <span className="topbar-user">{profile?.nombre || profile?.email}</span>
          <button className="btn secondary small" onClick={handleLogout}>Salir</button>
        </div>
      </header>

      <nav className="admin-nav">
        {SECCIONES.map(s => (
          <button
            key={s.id}
            className={`admin-nav-btn ${seccion === s.id ? 'active' : ''}`}
            onClick={() => setSeccion(s.id)}
          >
            {s.label}
          </button>
        ))}
      </nav>

      <main className="admin-main">
        {seccion === 'metricas'   && <SeccionMetricas />}
        {seccion === 'ligas'      && <SeccionLigas />}
        {seccion === 'usuarios'   && <SeccionUsuarios profile={profile} />}
        {seccion === 'peticiones' && <SeccionPeticiones />}
        {seccion === 'miliga'     && <SeccionMiLiga profile={profile} />}
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SECCIÓN: MÉTRICAS
// ════════════════════════════════════════════════════════════
function SeccionMetricas() {
  const [data, setData]     = useState(null);
  const [error, setError]   = useState(false);

  useEffect(() => {
    getMetricas()
      .then(setData)
      .catch(() => setError(true));
  }, []);

  if (error) return <p className="empty">Error al cargar métricas.</p>;
  if (!data)  return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;

  const { usuarios, ligas, partidos, equipos, ligasActivas, ligasInactivas, ultimosUsuarios, ultimasLigas } = data;

  return (
    <>
      <div className="admin-section-header">
        <h2>📊 Métricas de la plataforma</h2>
      </div>

      <div className="metricas-grid">
        <div className="metrica-card">
          <div className="metrica-val">{usuarios}</div>
          <div className="metrica-lbl">👤 Usuarios</div>
        </div>
        <div className="metrica-card">
          <div className="metrica-val">{ligas}</div>
          <div className="metrica-lbl">🏆 Ligas totales</div>
          <div className="metrica-sub">
            <span className="badge win">{ligasActivas} activas</span>
            <span className="badge danger">{ligasInactivas} inactivas</span>
          </div>
        </div>
        <div className="metrica-card">
          <div className="metrica-val">{equipos}</div>
          <div className="metrica-lbl">👥 Equipos</div>
        </div>
        <div className="metrica-card">
          <div className="metrica-val">{partidos}</div>
          <div className="metrica-lbl">🏐 Partidos jugados</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1.2rem' }}>
        <div>
          <h3 style={{ fontSize: '.95rem', marginBottom: '.7rem', color: 'var(--muted)' }}>Usuarios recientes</h3>
          {ultimosUsuarios.length === 0
            ? <p className="empty">Sin usuarios.</p>
            : ultimosUsuarios.map(u => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.nombre || '—'}</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                </div>
                <span className={`badge-role ${u.role}`}>
                  {u.role === 'superadmin' ? '⭐' : u.role === 'admin' ? '🛡' : '🏆'}
                </span>
              </div>
            ))
          }
        </div>

        <div>
          <h3 style={{ fontSize: '.95rem', marginBottom: '.7rem', color: 'var(--muted)' }}>Ligas recientes</h3>
          {ultimasLigas.length === 0
            ? <p className="empty">Sin ligas.</p>
            : ultimasLigas.map(l => (
              <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.5rem 0', borderBottom: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.nombre}</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{l.profiles?.nombre || l.profiles?.email || '—'}</div>
                </div>
                <span className={`badge ${l.activa ? 'win' : 'danger'}`}>{l.activa ? 'Activa' : 'Inactiva'}</span>
              </div>
            ))
          }
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  SECCIÓN: LIGAS
// ════════════════════════════════════════════════════════════
function SeccionLigas() {
  const [ligas, setLigas]   = useState(null);

  const cargar = useCallback(() => getTodasLigas().then(setLigas), []);
  useEffect(() => { cargar(); }, [cargar]);

  const toggle = async (id, activa) => {
    await actualizarLiga(id, { activa });
    toast(activa ? 'Liga activada' : 'Liga desactivada');
    cargar();
  };

  if (!ligas) return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;

  return (
    <>
      <div className="admin-section-header">
        <h2>Todas las ligas <span className="badge">{ligas.length}</span></h2>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Liga</th><th>Código</th><th>Organizador</th><th>Activa</th><th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {ligas.map(l => (
              <tr key={l.id}>
                <td>
                  <strong>{l.nombre}</strong>
                  {l.temporada && <><br /><small className="muted">{l.temporada}</small></>}
                </td>
                <td><code className="codigo-chip">{l.codigo}</code></td>
                <td>{l.profiles?.nombre || l.profiles?.email || '—'}</td>
                <td>
                  <span className={`badge ${l.activa ? 'win' : 'danger'}`}>
                    {l.activa ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>
                  <button className="btn secondary small" onClick={() => toggle(l.id, !l.activa)}>
                    {l.activa ? 'Desactivar' : 'Activar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  SECCIÓN: USUARIOS
// ════════════════════════════════════════════════════════════
function SeccionUsuarios({ profile }) {
  const [usuarios, setUsuarios] = useState(null);

  const cargar = useCallback(() => getTodosUsuarios().then(setUsuarios), []);
  useEffect(() => { cargar(); }, [cargar]);

  const toggleUser = async (uid, activo) => {
    try {
      activo ? await activarUsuario(uid) : await desactivarUsuario(uid);
      toast(activo ? 'Usuario activado' : 'Usuario desactivado');
      cargar();
    } catch (err) { toast(err.message, 'error'); }
  };

  const handleRol = async (uid, rol) => {
    try {
      await cambiarRol(uid, rol);
      toast('Rol actualizado');
      cargar();
    } catch (err) { toast(err.message, 'error'); }
  };

  if (!usuarios) return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;

  return (
    <>
      <div className="admin-section-header">
        <h2>Usuarios <span className="badge">{usuarios.length}</span></h2>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>Nombre / Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {usuarios.map(u => (
              <tr key={u.id}>
                <td>
                  <strong>{u.nombre || '—'}</strong><br />
                  <small className="muted">{u.email}</small>
                </td>
                <td><span className={`badge-role ${u.role}`}>{rolLabel(u.role)}</span></td>
                <td>
                  <span className={`badge ${u.activo ? 'win' : 'danger'}`}>
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="admin-acciones">
                  {u.id === profile?.id
                    ? <span className="muted">Tú</span>
                    : <>
                        {profile?.role === 'superadmin' && (
                          <select
                            className="select-rol small"
                            value={u.role}
                            onChange={e => handleRol(u.id, e.target.value)}
                          >
                            <option value="organizador">Organizador</option>
                            <option value="admin">Admin</option>
                            <option value="superadmin">Superadmin</option>
                          </select>
                        )}
                        <button
                          className={`btn ${u.activo ? 'danger' : 'secondary'} small`}
                          onClick={() => toggleUser(u.id, !u.activo)}
                        >
                          {u.activo ? 'Desactivar' : 'Activar'}
                        </button>
                      </>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  SECCIÓN: PETICIONES
// ════════════════════════════════════════════════════════════
function SeccionPeticiones() {
  const [pets, setPets] = useState(null);

  const cargar = useCallback(() => getPeticiones().then(setPets), []);
  useEffect(() => { cargar(); }, [cargar]);

  const responder = async (id, estado) => {
    await responderPeticion(id, estado);
    toast(estado === 'aprobada' ? 'Petición aprobada' : 'Petición rechazada');
    cargar();
  };

  if (!pets) return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;

  const pendientes = pets.filter(p => p.estado === 'pendiente');

  return (
    <>
      <div className="admin-section-header">
        <h2>Peticiones de liga extra <span className="badge">{pendientes.length} pendientes</span></h2>
      </div>
      {!pets.length
        ? <p className="empty">No hay peticiones.</p>
        : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr><th>Organizador</th><th>Mensaje</th><th>Estado</th><th>Acciones</th></tr>
              </thead>
              <tbody>
                {pets.map(p => (
                  <tr key={p.id}>
                    <td>{p.profiles?.nombre || p.profiles?.email || '—'}</td>
                    <td>{p.mensaje || '—'}</td>
                    <td>
                      <span className={`badge ${estadoBadge(p.estado)}`}>{p.estado}</span>
                    </td>
                    <td>
                      {p.estado === 'pendiente'
                        ? (
                          <div className="admin-acciones">
                            <button className="btn small" onClick={() => responder(p.id, 'aprobada')}>✓ Aprobar</button>
                            <button className="btn danger small" onClick={() => responder(p.id, 'rechazada')}>✕ Rechazar</button>
                          </div>
                        )
                        : '—'
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function rolLabel(r) {
  return { superadmin: '⭐ Superadmin', admin: '🛡 Admin', organizador: '🏆 Organizador' }[r] || r;
}
function estadoBadge(e) {
  return { pendiente: 'pending', aprobada: 'win', rechazada: 'danger' }[e] || '';
}

// ════════════════════════════════════════════════════════════
//  SECCIÓN: MI LIGA (liga de pruebas del admin)
// ════════════════════════════════════════════════════════════

// Tabs disponibles para la liga del admin — idénticos al organizador
const LIGA_TABS = [
  { id: 'tabla',    label: 'Tabla'       },
  { id: 'fixture',  label: 'Fixture'     },
  { id: 'partidos', label: 'Partidos'    },
  { id: 'equipos',  label: 'Equipos'     },
  { id: 'playoffs', label: '🏆 Playoffs' },
  { id: 'finanzas', label: '💰 Finanzas' },
  { id: 'config',   label: '⚙ Config'   },
];

const REGLAS_PRUEBA = [
  { nombre: 'Set 1', puntos: 25, diferencia: 2, usarPuntosSet: true },
  { nombre: 'Set 2', puntos: 25, diferencia: 2, usarPuntosSet: true },
  { nombre: 'Set 3 (desempate)', puntos: 15, diferencia: 2, usarPuntosSet: true },
];

function SeccionMiLiga({ profile }) {
  const [liga,      setLiga]      = useState(null);
  const [equipos,   setEquipos]   = useState([]);
  const [partidos,  setPartidos]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [creando,   setCreando]   = useState(false);
  const [activeTab, setActiveTab] = useState('tabla');

  const cargar = useCallback(async (ligaId) => {
    const [l, eqs, pts] = await Promise.all([
      getLigaById(ligaId),
      getEquipos(ligaId),
      getPartidos(ligaId),
    ]);
    setLiga(l); setEquipos(eqs); setPartidos(pts);
  }, []);

  // Buscar liga existente del admin (marcada como prueba)
  useEffect(() => {
    if (!profile) return;
    getMisLigas(profile.id).then(async ligas => {
      const prueba = ligas.find(l => l.config?.esPrueba);
      if (prueba) {
        await cargar(prueba.id);
      }
      setLoading(false);
    });
  }, [profile, cargar]);

  const refresh = useCallback(async () => {
    if (liga) await cargar(liga.id);
  }, [liga, cargar]);

  const crearLigaPrueba = async () => {
    setCreando(true);
    try {
      const l = await crearLiga({
        nombre:      'Liga de Prueba Admin',
        temporada:   'Prueba',
        ownerId:     profile.id,
        config:      { esPrueba: true, usarSets: true, usarPuntos: true, ptsVictoria: 2, ptsBono: 1, ptsDerota: 0, vueltas: 2, precioInscripcion: 0, precioArbitraje: 0 },
        reglas:      REGLAS_PRUEBA,
        playoffsCfg: {},
      });
      await cargar(l.id);
      toast('Liga de prueba creada ✓');
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setCreando(false);
    }
  };

  if (loading) return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;

  if (!liga) {
    return (
      <div className="empty-state">
        <div className="empty-icon">🧪</div>
        <h2>Liga de prueba</h2>
        <p className="muted" style={{ marginBottom: '1.2rem' }}>
          Crea una liga de prueba para testear funcionalidades sin afectar ligas reales.
          Tiene acceso completo: equipos, partidos, tabla y playoffs.
        </p>
        <button className="btn" onClick={crearLigaPrueba} disabled={creando}>
          {creando ? 'Creando…' : '+ Crear liga de prueba'}
        </button>
      </div>
    );
  }

  const tabProps = { liga, equipos, partidos, refresh, updateLiga: cambios => setLiga(l => ({ ...l, ...cambios })) };

  return (
    <>
      <div className="admin-section-header" style={{ marginBottom: '.5rem' }}>
        <h2>🧪 {liga.nombre}</h2>
        <code className="codigo-chip" style={{ fontSize: '.8rem' }}>{liga.codigo}</code>
        <span className="badge pending">Prueba</span>
      </div>

      <nav className="tab-nav" style={{ marginBottom: 0 }}>
        {LIGA_TABS.map(t => (
          <button key={t.id} className={activeTab === t.id ? 'active' : ''} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      <div className="section" style={{ paddingTop: '1rem' }}>
        {activeTab === 'tabla'    && <AdminTabTabla    {...tabProps} />}
        {activeTab === 'fixture'  && <AdminTabFixture  {...tabProps} />}
        {activeTab === 'partidos' && <AdminTabPartidos {...tabProps} />}
        {activeTab === 'equipos'  && <AdminTabEquipos  {...tabProps} />}
        {activeTab === 'playoffs' && <TabPlayoffs       {...tabProps} />}
        {activeTab === 'finanzas' && <TabFinanzas       {...tabProps} />}
        {activeTab === 'config'   && <TabConfig         liga={liga} refresh={refresh} updateLiga={cambios => setLiga(l => ({ ...l, ...cambios }))} />}
      </div>
    </>
  );
}

// ── Tabla ─────────────────────────────────────────────────────
function AdminTabTabla({ liga, equipos, partidos }) {
  const cfg      = liga.config || {};
  const usarPts  = cfg.usarPuntos  !== false;
  const usarSets = cfg.usarSets    !== false;
  const tabla    = calcTabla(equipos, partidos, cfg);
  if (!tabla.length) return <p className="empty">Sin equipos aún.</p>;
  return (
    <div className="tabla-wrap">
      <table className="tabla-pos">
        <thead><tr>
          <th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th>
          {usarSets && <><th>SG</th><th>SP</th></>}
          {usarPts  && <th>PTS</th>}
        </tr></thead>
        <tbody>
          {tabla.map((r, i) => (
            <tr key={r.equipo}>
              <td>{i + 1}</td><td>{r.equipo}</td>
              <td>{r.pj}</td><td className="green">{r.pg}</td><td className="red">{r.pp}</td>
              {usarSets && <><td>{r.sg}</td><td>{r.sp}</td></>}
              {usarPts  && <td className="pts-cell">{r.pts}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Fixture ───────────────────────────────────────────────────
function AdminTabFixture({ liga, equipos, partidos }) {
  const cfg     = liga.config || {};
  const vueltas = cfg.vueltas || 2;
  const noms    = equipos.map(e => e.nombre);
  const fixture = genFixture(noms);
  return (
    <>
      {Array.from({ length: vueltas }, (_, idx) => {
        const v = idx + 1;
        return (
          <div key={v}>
            <h3 style={{ marginTop: '1rem' }}>Vuelta {v}</h3>
            <div className="fixture-list">
              {fixture.map((enc, i) => {
                const eA = v === 1 ? enc.local : enc.visitante;
                const eB = v === 1 ? enc.visitante : enc.local;
                const p  = partidos.find(x =>
                  !x.es_playoff && x.vuelta === v &&
                  ((x.equipo_a === eA && x.equipo_b === eB) || (x.equipo_a === eB && x.equipo_b === eA))
                );
                return (
                  <div key={i} className={`fixture-item ${p?.jugado ? 'jugado' : ''}`}>
                    <span className={`badge ${v === 1 ? 'pending' : 'done'}`}>V{v}</span>
                    <div className="fixture-teams">
                      <span>{eA}</span>
                      <span className="fixture-vs">{p?.jugado ? `${p.sets_a}:${p.sets_b}` : 'vs'}</span>
                      <span>{eB}</span>
                    </div>
                    {p?.fecha && <span className="fixture-date">{formatFecha(p.fecha)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Partidos ──────────────────────────────────────────────────
function AdminTabPartidos({ liga, equipos, partidos, refresh }) {
  const cfg      = liga.config || {};
  const usarSets = cfg.usarSets !== false;
  const reglas   = REGLAS_PRUEBA;
  const [vuelta,  setVuelta]  = useState(1);
  const [fecha,   setFecha]   = useState('');
  const [eqA,     setEqA]     = useState('');
  const [eqB,     setEqB]     = useState('');
  const [ganSimple, setGanSimple] = useState('');
  const [sets, setSets] = useState(reglas.map(() => ({ a: '', b: '' })));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!eqA || !eqB) { toast('Selecciona ambos equipos', 'error'); return; }
    if (eqA === eqB)  { toast('Los equipos deben ser diferentes', 'error'); return; }
    if (!fecha)       { toast('La fecha es obligatoria', 'error'); return; }
    let sA = 0, sB = 0, ganador = null, setsData = [];
    if (!usarSets) {
      if (!ganSimple) { toast('Selecciona quién ganó', 'error'); return; }
      ganador = ganSimple; sA = ganador === 'A' ? 1 : 0; sB = 1 - sA;
    } else {
      const res = leerSets(sets, reglas);
      if (!res.ok) { toast(res.msg, 'error'); return; }
      setsData = res.sets; sA = res.sA; sB = res.sB; ganador = res.ganador;
    }
    const existe = partidos.some(p => !p.es_playoff && p.vuelta === vuelta &&
      ((p.equipo_a === eqA && p.equipo_b === eqB) || (p.equipo_a === eqB && p.equipo_b === eqA)));
    if (existe) { toast('Ya existe este partido en esa vuelta', 'error'); return; }
    try {
      await guardarPartido(liga.id, { vuelta, fecha, equipo_a: eqA, equipo_b: eqB, sets: setsData, sets_a: sA, sets_b: sB, ganador, jugado: true, pago_arb_a: false, pago_arb_b: false });
      toast(`✓ ${eqA} ${sA}:${sB} ${eqB}`);
      setFecha(''); setEqA(''); setEqB(''); setGanSimple(''); setSets(reglas.map(() => ({ a: '', b: '' })));
      refresh();
    } catch (err) { toast(err.message, 'error'); }
  };

  const norm = partidos.filter(p => !p.es_playoff);
  return (
    <>
      <h2>Registrar <span>Partido</span></h2>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Vuelta</label>
              <select value={vuelta} onChange={e => setVuelta(parseInt(e.target.value))}>
                {Array.from({ length: cfg.vueltas || 2 }, (_, i) => <option key={i+1} value={i+1}>Vuelta {i+1}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Fecha *</label>
              <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Equipo A</label>
              <select value={eqA} onChange={e => setEqA(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {equipos.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Equipo B</label>
              <select value={eqB} onChange={e => setEqB(e.target.value)}>
                <option value="">— Seleccionar —</option>
                {equipos.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            {!usarSets ? (
              <div className="set-block">
                <h4>Resultado</h4>
                {['A','B'].map(v => (
                  <label key={v} style={{ display:'flex', alignItems:'center', gap:'.5rem', cursor:'pointer', marginBottom:'.3rem' }}>
                    <input type="radio" name="gan-prueba" value={v} checked={ganSimple===v} onChange={() => setGanSimple(v)} />
                    Equipo {v} gana
                  </label>
                ))}
              </div>
            ) : (
              <div className="sets-grid">
                {reglas.map((r, i) => {
                  const esDesempate = i === reglas.length - 1 && reglas.length > 1;
                  const setsParaGanar = Math.ceil(reglas.length / 2);

                  if (esDesempate) {
                    let sA = 0, sB = 0, todosCompletos = true;
                    for (let j = 0; j < i; j++) {
                      const pA = parseInt(sets[j]?.a);
                      const pB = parseInt(sets[j]?.b);
                      if (isNaN(pA) || isNaN(pB)) { todosCompletos = false; break; }
                      if (pA > pB) sA++; else sB++;
                    }
                    if (!todosCompletos || sA !== sB) return null;
                  } else {
                    let sA = 0, sB = 0;
                    for (let j = 0; j < i; j++) {
                      const pA = parseInt(sets[j]?.a);
                      const pB = parseInt(sets[j]?.b);
                      if (!isNaN(pA) && !isNaN(pB)) {
                        if (pA > pB) sA++; else sB++;
                      }
                    }
                    if (sA >= setsParaGanar || sB >= setsParaGanar) return null;
                  }

                  return (
                    <div key={i} className="set-block">
                      <h4>{r.nombre}{esDesempate && <small style={{ color: 'var(--accent)', fontSize: '.7rem' }}> (Desempate)</small>}</h4>
                      <div className="set-score">
                        <input type="number" min={0} max={999} placeholder="Eq A" value={sets[i]?.a || ''}
                          onChange={e => setSets(prev => prev.map((s, j) => j===i ? {...s, a: e.target.value} : s))} />
                        <span>—</span>
                        <input type="number" min={0} max={999} placeholder="Eq B" value={sets[i]?.b || ''}
                          onChange={e => setSets(prev => prev.map((s, j) => j===i ? {...s, b: e.target.value} : s))} />
                      </div>
                      <p className="note">Mín {r.puntos} · Dif ≥ {r.diferencia}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex mt1">
            <button type="submit" className="btn">Guardar partido</button>
            <button type="reset" className="btn secondary" onClick={() => { setFecha(''); setEqA(''); setEqB(''); setGanSimple(''); setSets(reglas.map(() => ({a:'',b:''}))); }}>Limpiar</button>
          </div>
        </form>
      </div>
      <h2 style={{ marginTop: '1.5rem' }}>Partidos registrados</h2>
      {!norm.length ? <p className="empty">No hay partidos aún.</p>
        : norm.sort((a,b) => a.vuelta-b.vuelta).map(p => (
          <div key={p.id} className="fixture-item">
            <span className={`badge ${p.vuelta===1?'pending':'done'}`}>V{p.vuelta}</span>
            <div className="fixture-teams">
              <span>{p.equipo_a}</span>
              <span className="fixture-vs">{usarSets ? `${p.sets_a}:${p.sets_b}` : 'G:P'}</span>
              <span>{p.equipo_b}</span>
            </div>
            {p.fecha && <span className="fixture-date">{formatFecha(p.fecha)}</span>}
            <span className="badge win">🏆 {p.ganador==='A'?p.equipo_a:p.equipo_b}</span>
            <button className="btn danger small" onClick={async () => { if(!window.confirm('¿Eliminar?')) return; await eliminarPartido(p.id); refresh(); toast('Partido eliminado'); }}>Eliminar</button>
          </div>
        ))
      }
    </>
  );
}

// ── Equipos ───────────────────────────────────────────────────
function AdminTabEquipos({ liga, equipos, refresh }) {
  const [nombre, setNombre] = useState('');
  const agregar = async () => {
    const nom = nombre.trim();
    if (!nom) { toast('Escribe un nombre', 'error'); return; }
    if (equipos.some(e => e.nombre.toLowerCase() === nom.toLowerCase())) { toast('Nombre duplicado', 'error'); return; }
    await agregarEquipo(liga.id, nom);
    setNombre(''); refresh(); toast('Equipo agregado ✓');
  };
  const eliminar = async id => {
    if (!window.confirm('¿Eliminar equipo?')) return;
    await eliminarEquipo(id); refresh(); toast('Equipo eliminado');
  };
  return (
    <>
      <h2>Equipos</h2>
      <div className="card">
        <div className="form-row">
          <input type="text" placeholder="Nombre del equipo" maxLength={40} style={{ flex: 1 }}
            value={nombre} onChange={e => setNombre(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), agregar())} />
          <button className="btn" onClick={agregar}>+ Agregar</button>
        </div>
      </div>
      <div style={{ marginTop: '1rem' }}>
        {!equipos.length ? <p className="empty">No hay equipos.</p>
          : equipos.map(e => (
            <div key={e.id} className="fixture-item">
              <span style={{ fontWeight: 600, flex: 1 }}>{e.nombre}</span>
              <button className="btn danger small" onClick={() => eliminar(e.id)}>Eliminar</button>
            </div>
          ))
        }
      </div>
    </>
  );
}

// ── Helpers locales ────────────────────────────────────────────
function calcTabla(equipos, partidos, cfg) {
  const usarPts  = cfg.usarPuntos !== false;
  const usarSets = cfg.usarSets   !== false;
  const ptsV = cfg.ptsVictoria ?? 2, ptsB = cfg.ptsBono ?? 1, ptsD = cfg.ptsDerota ?? 0;
  const t = {};
  equipos.forEach(e => { t[e.nombre] = { equipo: e.nombre, pj:0, pg:0, pp:0, sg:0, sp:0, pts:0 }; });
  partidos.filter(p => p.jugado && !p.es_playoff).forEach(p => {
    const a = t[p.equipo_a], b = t[p.equipo_b];
    if (!a || !b) return;
    a.pj++; b.pj++;
    if (usarSets) { a.sg+=p.sets_a; a.sp+=p.sets_b; b.sg+=p.sets_b; b.sp+=p.sets_a; }
    if (p.ganador==='A') { a.pg++; b.pp++; if(usarPts){a.pts+=ptsV;b.pts+=ptsD;if(usarSets&&p.sets_b>0)b.pts+=ptsB;} }
    else                 { b.pg++; a.pp++; if(usarPts){b.pts+=ptsV;a.pts+=ptsD;if(usarSets&&p.sets_a>0)a.pts+=ptsB;} }
  });
  return Object.values(t).sort((a,b) => {
    if (usarPts && b.pts!==a.pts) return b.pts-a.pts;
    if (b.pg!==a.pg) return b.pg-a.pg;
    if (usarSets) return (b.sg-b.sp)-(a.sg-a.sp);
    return 0;
  });
}

function genFixture(noms) {
  const enc = [];
  for (let i=0; i<noms.length; i++)
    for (let j=i+1; j<noms.length; j++)
      enc.push({ local: noms[i], visitante: noms[j] });
  return enc;
}

function leerSets(sets, reglas) {
  const result = []; let sA = 0, sB = 0;
  for (let i = 0; i < reglas.length; i++) {
    const pA = parseInt(sets[i]?.a), pB = parseInt(sets[i]?.b);
    if (isNaN(pA)||isNaN(pB)) return { ok:false, msg:`Completa el set ${i+1}` };
    const r = reglas[i];
    const max=Math.max(pA,pB), min=Math.min(pA,pB);
    if (max<r.puntos||(max-min)<r.diferencia) return { ok:false, msg:`Set ${i+1} inválido: ${pA}-${pB}` };
    result.push({pA,pB});
    if (pA>pB) sA++; else sB++;
    const spg = Math.ceil(reglas.length/2);
    if (sA>=spg||sB>=spg) break;
  }
  const spg = Math.ceil(reglas.length/2);
  const ganador = sA>=spg?'A':sB>=spg?'B':null;
  if (!ganador) return { ok:false, msg:'No hay ganador aún.' };
  return { ok:true, sets:result, sA, sB, ganador };
}
