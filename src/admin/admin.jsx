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
  getLigaById, getEquipos, getPartidos,
  actualizarPerfil,
} from '../lib/db.js';
import TabPlayoffs from '../liga/TabPlayoffs.jsx';
import { TabTabla, TabFixture, TabPartidos, TabEquipos, TabFinanzas, TabConfig } from '../liga/liga-dashboard.jsx';
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
  const [data, setData]   = useState(null);
  const [error, setError] = useState(false);

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
  const [ligas, setLigas] = useState(null);
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

  const togglePlan = async (uid, planActual) => {
    try {
      const nuevoPlan = planActual === 'pro' ? 'free' : 'pro';
      await actualizarPerfil(uid, {
        plan: nuevoPlan,
        plan_expira: null,
        plan_origen: 'manual',
      });
      toast(nuevoPlan === 'pro' ? '⭐ Plan Pro activado' : 'Plan revertido a Free');
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
                        <button
                          className={`btn ${u.plan === 'pro' ? 'secondary' : ''} small`}
                          style={{ borderColor: 'var(--accent)', color: u.plan === 'pro' ? 'var(--muted)' : 'var(--accent)' }}
                          onClick={() => togglePlan(u.id, u.plan)}
                        >
                          {u.plan === 'pro' ? '⭐ Pro activo' : '🔓 Activar Pro'}
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
        {activeTab === 'tabla'    && <TabTabla    {...tabProps} />}
        {activeTab === 'fixture'  && <TabFixture  {...tabProps} />}
        {activeTab === 'partidos' && <TabPartidos {...tabProps} />}
        {activeTab === 'equipos'  && <TabEquipos  {...tabProps} />}
        {activeTab === 'playoffs' && <TabPlayoffs {...tabProps} />}
        {activeTab === 'finanzas' && <TabFinanzas {...tabProps} />}
        {activeTab === 'config'   && <TabConfig   liga={liga} refresh={refresh} updateLiga={cambios => setLiga(l => ({ ...l, ...cambios }))} onEliminar={async () => { if (!window.confirm('¿Eliminar la liga de prueba? Esta acción no se puede deshacer.')) return; const { eliminarLiga } = await import('../lib/db.js'); await eliminarLiga(liga.id); setLiga(null); toast('Liga de prueba eliminada'); }} />}
      </div>
    </>
  );
}
