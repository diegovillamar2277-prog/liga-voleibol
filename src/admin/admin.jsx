// ============================================================
//  admin.jsx — Panel de administrador (React)
// ============================================================
import { AuthProvider } from '../context/AuthContext.jsx';
import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { sb } from '../lib/supabase.js';
import {
  getTodosUsuarios, cambiarRol, desactivarUsuario, activarUsuario,
  getTodasLigas, actualizarLiga,
  getMetricas, getMisLigas, crearLiga,
  getLigaById, getEquipos, getPartidos,
  actualizarPerfil,
} from '../lib/db.js';
import TabPlayoffs from '../liga/TabPlayoffs.jsx';
import { TabTabla, TabFixture, TabPartidos, TabEquipos, TabFinanzas, TabConfig, TabComentarios } from '../liga/liga-dashboard.jsx';
import { toast, formatFecha } from '../lib/ui.js';
import PushToggle from '../components/PushToggle.jsx';

// ── Punto de entrada ─────────────────────────────────────────
let _root = null;
let _container = null;

export function unmountAdminPanel() {
  if (_root) { _root.unmount(); _root = null; _container = null; }
}

export function renderAdminPanel(container, profile) {
  if (_root && _container !== container) { _root.unmount(); _root = null; }
  if (!_root) { _root = createRoot(container); _container = container; }
  _root.render(
    <AuthProvider>
      <AdminPanelApp profile={profile} />
    </AuthProvider>
  );
}

// ════════════════════════════════════════════════════════════
//  COMPONENTE RAÍZ
// ════════════════════════════════════════════════════════════
const SECCIONES = [
  { id: 'metricas',   label: '📊 Métricas'   },
  { id: 'ligas',      label: '🏆 Ligas'       },
  { id: 'usuarios',   label: '👤 Usuarios'    },
  { id: 'miliga',     label: '🧪 Mi liga'     },
];

function AdminPanelApp({ profile }) {
  const [seccion, setSeccion] = useState('metricas');

  const handleLogout = async () => { await sb.auth.signOut(); };

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
        {seccion === 'miliga'     && <SeccionMiLiga profile={profile} />}
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  SECCIÓN: MÉTRICAS
// ════════════════════════════════════════════════════════════
function SeccionMetricas() {
  const [data,  setData]  = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getMetricas().then(setData).catch(() => setError(true));
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
  const [usuarios,    setUsuarios]    = useState(null);
  const [editandoId,  setEditandoId]  = useState(null); // id del usuario con panel abierto
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

  const planBadge = (u) => {
    const p = u.plan || 'basico';
    const expirado = p !== 'basico' && u.plan_expira && new Date(u.plan_expira) < new Date();
    if (expirado) return { label: '🆓 Expirado', color: 'danger' };
    if (p === 'top'   || p === 'pro')  return { label: '🏆 Top',   color: 'win'     };
    if (p === 'medio')                 return { label: '⚡ Medio', color: 'pending' };
    return { label: '🆓 Básico', color: '' };
  };

  return (
    <>
      <div className="admin-section-header">
        <h2>Usuarios <span className="badge">{usuarios.length}</span></h2>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Nombre / Correo</th>
              <th>Rol</th>
              <th>Plan</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {usuarios.map(u => {
              const badge   = planBadge(u);
              const esSelf  = u.id === profile?.id;
              const abierto = editandoId === u.id;
              return (
                <>
                  <tr key={u.id}>
                    <td>
                      <strong>{u.nombre || '—'}</strong><br />
                      <small className="muted">{u.email}</small>
                    </td>
                    <td>
                      <span className={`badge-role ${u.role}`}>{rolLabel(u.role)}</span>
                    </td>
                    <td>
                      <span className={`badge ${badge.color}`}>{badge.label}</span>
                      {u.plan_expira && !['basico','free'].includes(u.plan) && (
                        <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.15rem' }}>
                          {u.plan_expira === 'forever'
                            ? '♾ Para siempre'
                            : `Hasta ${new Date(u.plan_expira).toLocaleDateString('es-MX')}`
                          }
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.activo ? 'win' : 'danger'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td className="admin-acciones">
                      {esSelf
                        ? <span className="muted">Tú</span>
                        : (
                          <button
                            className="btn secondary small"
                            onClick={() => setEditandoId(abierto ? null : u.id)}
                          >
                            {abierto ? '▲ Cerrar' : '⚙ Gestionar'}
                          </button>
                        )
                      }
                    </td>
                  </tr>

                  {/* Panel expandible de gestión */}
                  {abierto && !esSelf && (
                    <tr key={u.id + '-panel'}>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <PanelUsuario
                          u={u}
                          isSuperAdmin={profile?.role === 'superadmin'}
                          onRol={handleRol}
                          onToggle={toggleUser}
                          onPlanCambiado={cargar}
                          onCerrar={() => setEditandoId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ── Panel expandible por usuario ──────────────────────────────
const OPCIONES_PLAN = [
  { value: 'basico',         label: '🆓 Básico (gratis)',    plan: 'basico', meses: null  },
  { value: 'medio_1mes',     label: '⚡ Medio — 1 mes',      plan: 'medio',  meses: 1     },
  { value: 'medio_6meses',   label: '⚡ Medio — 6 meses',    plan: 'medio',  meses: 6     },
  { value: 'top_1mes',       label: '🏆 Top — 1 mes',        plan: 'top',    meses: 1     },
  { value: 'top_6meses',     label: '🏆 Top — 6 meses',      plan: 'top',    meses: 6     },
  { value: 'top_forever',    label: '🏆 Top — Para siempre', plan: 'top',    meses: -1    },
  { value: 'medio_forever',  label: '⚡ Medio — Para siempre',plan: 'medio', meses: -1    },
];

function planActualToOpcion(u) {
  const p = u.plan || 'basico';
  if (p === 'basico' || p === 'free') return 'basico';
  if (p === 'pro') return 'top_forever'; // legacy
  if (u.plan_expira === 'forever') return p === 'top' ? 'top_forever' : 'medio_forever';
  return 'basico'; // default si no matchea
}

function PanelUsuario({ u, isSuperAdmin, onRol, onToggle, onPlanCambiado, onCerrar }) {
  const planInicial = planActualToOpcion(u);
  const [planSel,   setPlanSel]   = useState(planInicial);
  const [fechaExact,setFechaExact]= useState('');
  const [usarFecha, setUsarFecha] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmElim, setConfirmElim] = useState(false); // 'desactivar' | 'eliminar' | false

  const opcionActual = OPCIONES_PLAN.find(o => o.value === planSel) || OPCIONES_PLAN[0];

  const guardarPlan = async () => {
    setGuardando(true);
    try {
      let expira = null;
      if (opcionActual.plan === 'basico') {
        expira = null;
      } else if (usarFecha && fechaExact) {
        expira = new Date(fechaExact).toISOString();
      } else if (opcionActual.meses === -1) {
        expira = 'forever';
      } else if (opcionActual.meses > 0) {
        const d = new Date();
        d.setMonth(d.getMonth() + opcionActual.meses);
        expira = d.toISOString();
      }

      // Si bajamos a básico, también quitamos el add-on
      const extraFields = opcionActual.plan === 'basico'
        ? { addon_vista_publica: false, addon_vp_expira: null }
        : {};

      await actualizarPerfil(u.id, {
        plan:        opcionActual.plan,
        plan_expira: expira,
        plan_origen: 'manual',
        ...extraFields,
      });

      toast(`${opcionActual.label} asignado a ${u.nombre || u.email}`);
      onPlanCambiado();
      onCerrar();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const toggleAddonVistaPublica = async () => {
    try {
      const tieneAddon = !!u.addon_vista_publica;
      await actualizarPerfil(u.id, {
        addon_vista_publica: !tieneAddon,
        addon_vp_expira: !tieneAddon ? null : undefined, // null = para siempre al activar
      });
      toast(!tieneAddon ? '🌐 Vista pública activada' : 'Vista pública desactivada');
      onPlanCambiado();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const eliminarCuenta = async () => {
    try {
      // Desactivar en profiles (la cuenta de auth.users la borra Supabase en cascada)
      await actualizarPerfil(u.id, { activo: false });
      // Intentar eliminar de auth (requiere service key, solo funciona en servidor)
      // Por ahora solo desactivamos
      toast(`Cuenta de ${u.nombre || u.email} desactivada permanentemente`);
      onPlanCambiado();
      onCerrar();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div style={{
      background: 'var(--bg2)', borderTop: '1px solid var(--border)',
      borderBottom: '2px solid var(--accent)', padding: '1.2rem 1.4rem',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.2rem', flexWrap: 'wrap' }}>

        {/* ── Columna 1: Plan ── */}
        <div>
          <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.6rem' }}>
            Plan
          </p>
          <select
            value={planSel}
            onChange={e => { setPlanSel(e.target.value); setUsarFecha(false); }}
            style={{ width: '100%', marginBottom: '.6rem' }}
          >
            {OPCIONES_PLAN.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Fecha exacta — solo si el plan no es basico */}
          {opcionActual.plan !== 'basico' && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.8rem', color: 'var(--muted2)', cursor: 'pointer', marginBottom: '.5rem' }}>
              <input type="checkbox" checked={usarFecha} onChange={e => setUsarFecha(e.target.checked)}
                style={{ accentColor: 'var(--accent)' }} />
              Usar fecha exacta
            </label>
          )}
          {usarFecha && opcionActual.plan !== 'basico' && (
            <input type="date" value={fechaExact} onChange={e => setFechaExact(e.target.value)}
              min={new Date().toISOString().slice(0,10)}
              style={{ width: '100%', fontSize: '.85rem' }} />
          )}

          {/* Resumen de lo que se va a asignar */}
          <div style={{ marginTop: '.6rem', padding: '.5rem .7rem', background: 'var(--card)', borderRadius: 8, fontSize: '.78rem', color: 'var(--text2)', border: '1px solid var(--border)' }}>
            {opcionActual.plan === 'basico' && '🆓 Sin fecha de expiración'}
            {opcionActual.plan !== 'basico' && !usarFecha && opcionActual.meses === -1 && '♾ Sin expiración (para siempre)'}
            {opcionActual.plan !== 'basico' && !usarFecha && opcionActual.meses > 0 && `📅 Expira en ${opcionActual.meses} mes${opcionActual.meses > 1 ? 'es' : ''}`}
            {opcionActual.plan !== 'basico' && usarFecha && fechaExact && `📅 Expira el ${new Date(fechaExact).toLocaleDateString('es-MX')}`}
            {opcionActual.plan !== 'basico' && usarFecha && !fechaExact && '⚠ Selecciona una fecha'}
          </div>

          <button className="btn" style={{ width: '100%', marginTop: '.7rem' }}
            onClick={guardarPlan} disabled={guardando || (usarFecha && !fechaExact)}>
            {guardando ? 'Guardando…' : '💾 Guardar plan'}
          </button>

          {/* Add-on vista pública — solo relevante si está en básico */}
          {(opcionActual.plan === 'basico' || u.plan === 'basico' || !u.plan) && (
            <div style={{ marginTop: '.8rem', paddingTop: '.8rem', borderTop: '1px solid var(--border)' }}>
              <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.5rem' }}>
                Add-on vista pública
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem' }}>
                <div>
                  <span className={`badge ${u.addon_vista_publica ? 'win' : ''}`}>
                    {u.addon_vista_publica ? '🌐 Activo' : '🔒 Inactivo'}
                  </span>
                  {u.addon_vista_publica && u.addon_vp_expira && (
                    <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.2rem' }}>
                      Hasta {new Date(u.addon_vp_expira).toLocaleDateString('es-MX')}
                    </div>
                  )}
                  {u.addon_vista_publica && !u.addon_vp_expira && (
                    <div style={{ fontSize: '.7rem', color: 'var(--muted)', marginTop: '.2rem' }}>♾ Para siempre</div>
                  )}
                </div>
                <button
                  className={`btn ${u.addon_vista_publica ? 'secondary' : ''} small`}
                  style={{ fontSize: '.75rem' }}
                  onClick={toggleAddonVistaPublica}
                >
                  {u.addon_vista_publica ? 'Desactivar' : '+ Activar gratis'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Columna 2: Rol y estado ── */}
        <div>
          <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.6rem' }}>
            Rol y estado
          </p>
          {isSuperAdmin && (
            <div style={{ marginBottom: '.8rem' }}>
              <label style={{ fontSize: '.78rem', color: 'var(--muted2)', fontWeight: 600, display: 'block', marginBottom: '.3rem' }}>Rol</label>
              <select className="select-rol" style={{ width: '100%' }}
                value={u.role} onChange={e => onRol(u.id, e.target.value)}>
                <option value="organizador">🏆 Organizador</option>
                <option value="admin">🛡 Admin</option>
                <option value="superadmin">⭐ Superadmin</option>
              </select>
            </div>
          )}
          <div>
            <label style={{ fontSize: '.78rem', color: 'var(--muted2)', fontWeight: 600, display: 'block', marginBottom: '.3rem' }}>Estado de acceso</label>
            <button
              className={`btn ${u.activo ? 'danger' : 'secondary'} small`}
              style={{ width: '100%' }}
              onClick={() => onToggle(u.id, !u.activo)}
            >
              {u.activo ? '🔒 Desactivar cuenta' : '🔓 Activar cuenta'}
            </button>
            <p className="muted" style={{ fontSize: '.72rem', marginTop: '.4rem' }}>
              {u.activo
                ? 'El usuario no podrá iniciar sesión.'
                : 'El usuario podrá volver a iniciar sesión.'
              }
            </p>
          </div>
        </div>

        {/* ── Columna 3: Zona de peligro ── */}
        <div>
          <p style={{ fontSize: '.72rem', fontWeight: 700, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: '.6rem' }}>
            Zona de peligro
          </p>

          {!confirmElim ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
              <button className="btn danger small" style={{ width: '100%', fontSize: '.8rem' }}
                onClick={() => setConfirmElim('desactivar')}>
                🚫 Desactivar permanentemente
              </button>
              <button className="btn danger small" style={{ width: '100%', fontSize: '.8rem', opacity: .8 }}
                onClick={() => setConfirmElim('eliminar')}>
                🗑 Eliminar cuenta
              </button>
              <p className="muted" style={{ fontSize: '.7rem', lineHeight: 1.4 }}>
                <strong>Desactivar:</strong> el usuario no puede acceder, sus ligas se conservan.<br />
                <strong>Eliminar:</strong> borra el perfil. Las ligas quedan huérfanas.
              </p>
            </div>
          ) : (
            <div style={{ background: 'var(--red-soft)', border: '1px solid rgba(244,63,94,.3)', borderRadius: 'var(--radius)', padding: '.9rem' }}>
              <p style={{ fontSize: '.83rem', fontWeight: 700, marginBottom: '.6rem', color: 'var(--red)' }}>
                {confirmElim === 'eliminar'
                  ? `¿Eliminar a ${u.nombre || u.email}?`
                  : `¿Desactivar permanentemente a ${u.nombre || u.email}?`
                }
              </p>
              <p className="muted" style={{ fontSize: '.75rem', marginBottom: '.7rem' }}>
                {confirmElim === 'eliminar'
                  ? 'Se borrará el perfil. Esta acción no se puede deshacer.'
                  : 'No podrá iniciar sesión. Sus ligas se conservan.'
                }
              </p>
              <div style={{ display: 'flex', gap: '.4rem' }}>
                <button className="btn danger small" style={{ flex: 1 }}
                  onClick={async () => {
                    if (confirmElim === 'eliminar') {
                      if (!window.confirm(`¿Confirmar eliminación de ${u.nombre || u.email}?`)) return;
                      try {
                        await actualizarPerfil(u.id, { activo: false });
                        toast(`Perfil de ${u.nombre || u.email} desactivado. Para eliminar completamente usa el panel de Supabase.`);
                        onPlanCambiado(); onCerrar();
                      } catch (err) { toast(err.message, 'error'); }
                    } else {
                      try {
                        await actualizarPerfil(u.id, { activo: false });
                        toast(`${u.nombre || u.email} desactivado permanentemente`);
                        onPlanCambiado(); onCerrar();
                      } catch (err) { toast(err.message, 'error'); }
                    }
                  }}
                >
                  Confirmar
                </button>
                <button className="btn secondary small" style={{ flex: 1 }}
                  onClick={() => setConfirmElim(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '.8rem', display: 'flex', justifyContent: 'flex-end' }}>
        <button className="btn secondary small" onClick={onCerrar}>✕ Cerrar</button>
      </div>
    </div>
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
const LIGA_TABS = [
  { id: 'tabla',       label: 'Tabla'          },
  { id: 'fixture',     label: 'Fixture'        },
  { id: 'partidos',    label: 'Partidos'       },
  { id: 'equipos',     label: 'Equipos'        },
  { id: 'playoffs',    label: '🏆 Playoffs'    },
  { id: 'finanzas',    label: '💰 Finanzas'    },
  { id: 'comentarios', label: '💬 Comentarios' },
  { id: 'config',      label: '⚙ Config'      },
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

  useEffect(() => {
    if (!profile) return;
    getMisLigas(profile.id).then(async ligas => {
      const prueba = ligas.find(l => l.config?.esPrueba);
      if (prueba) await cargar(prueba.id);
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
        config:      {
          esPrueba: true, usarSets: true, usarPuntos: true,
          ptsVictoria: 2, ptsBono: 1, ptsDerota: 0,
          vueltas: 2, precioInscripcion: 0, precioArbitraje: 0,
        },
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

  const tabProps = {
    liga,
    equipos,
    partidos,
    refresh,
    updateLiga: cambios => setLiga(l => ({ ...l, ...cambios })),
  };

  return (
    <>
      <div className="admin-section-header" style={{ marginBottom: '.5rem' }}>
        <h2>🧪 {liga.nombre}</h2>
        <code className="codigo-chip" style={{ fontSize: '.8rem' }}>{liga.codigo}</code>
        <span className="badge pending">Prueba</span>
      </div>
      <nav className="tab-nav" style={{ marginBottom: 0 }}>
        {LIGA_TABS.map(t => (
          <button
            key={t.id}
            className={activeTab === t.id ? 'active' : ''}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>
      <div className="section" style={{ paddingTop: '1rem' }}>
        {activeTab === 'tabla'       && <TabTabla      {...tabProps} />}
        {activeTab === 'fixture'     && <TabFixture    {...tabProps} />}
        {activeTab === 'partidos'    && <TabPartidos   {...tabProps} />}
        {activeTab === 'equipos'     && <TabEquipos    {...tabProps} />}
        {activeTab === 'playoffs'    && <TabPlayoffs   liga={liga} equipos={equipos} partidos={partidos} refresh={refresh} />}
        {activeTab === 'finanzas'    && <TabFinanzas   {...tabProps} />}
        {activeTab === 'comentarios' && <TabComentarios liga={liga} />}
        {activeTab === 'config'      && (
          <TabConfig
            liga={liga}
            refresh={refresh}
            updateLiga={cambios => setLiga(l => ({ ...l, ...cambios }))}
          />
        )}
      </div>
    </>
  );
}
