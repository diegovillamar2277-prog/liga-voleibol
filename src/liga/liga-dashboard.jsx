// ============================================================
//  liga-dashboard.jsx  — Panel del organizador
// ============================================================
import { AuthProvider, useAuth } from '../context/AuthContext.jsx';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { sb } from '../lib/supabase.js';
import {
  getLigaById, getMisLigas, actualizarLiga, renovarCodigo, actualizarAlias,
  getEquipos, agregarEquipo, actualizarEquipo, eliminarEquipo,
  getPartidos, guardarPartido, actualizarPartido, eliminarPartido,
  invitarCoAdmin, quitarMiembro, getMiembros,
  contarLigasDeUsuario, crearLiga, enviarPeticion, eliminarLiga,
  getComentarios, eliminarComentario,
} from '../lib/db.js';
import { toast, formatFecha } from '../lib/ui.js';
import { PLANES, getPlan } from '../lib/planes.js';
import ModalPago from '../components/ModalPago.jsx';
import TabPlayoffs from '../liga/TabPlayoffs.jsx';
import { saveSnapshot } from '../lib/offline.js';
import { notifyDesdePartidoGuardado } from '../lib/push.js';
import PushToggle from '../components/PushToggle.jsx';

let _root = null;
let _container = null;

export function unmountOrgPanel() {
  if (_root) { _root.unmount(); _root = null; _container = null; }
}

export function renderOrgPanel(container, profile) {
  if (_root && _container !== container) { _root.unmount(); _root = null; }
  if (!_root) { _root = createRoot(container); _container = container; }
  _root.render(<AuthProvider><OrgPanelApp profile={profile} /></AuthProvider>);
}

// ════════════════════════════════════════════════════════════
//  APP PRINCIPAL
// ════════════════════════════════════════════════════════════
function OrgPanelApp({ profile }) {
  const currentProfile = profile;
  const [misLigas,   setMisLigas]   = useState(null);
  const [ligaActual, setLigaActual] = useState(null);
  const [screen,     setScreen]     = useState('loading');

  useEffect(() => {
    if (!currentProfile) return;
    getMisLigas(currentProfile.id).then(ligas => {
      setMisLigas(ligas);
      const planObj  = getPlan(currentProfile);
      const savedId  = localStorage.getItem('ligaActualId');
      if (savedId) {
        const saved = ligas.find(l => l.id === savedId);
        if (saved) { setLigaActual(saved); setScreen('liga'); return; }
      }
      if (ligas.length === 0) {
        setScreen('sinligas');
      } else if (ligas.length === 1 && planObj.maxLigas === 1) {
        // Plan básico con 1 liga → ir directo (no puede crear más)
        setLigaActual(ligas[0]); setScreen('liga');
      } else {
        // Tiene 2+ ligas, O el plan permite más → mostrar selector siempre
        setScreen('selector');
      }
    });
  }, [currentProfile]);

  const handleLogout = async () => {
    localStorage.removeItem('ligaActualId');
    await sb.auth.signOut();
  };

  const abrirLiga = useCallback(liga => {
    localStorage.setItem('ligaActualId', liga.id);
    setLigaActual(liga); setScreen('liga');
  }, []);

  const irACrear = useCallback(() => setScreen('crear'), []);

  const volverASelector = useCallback(() => {
    localStorage.removeItem('ligaActualId');
    setLigaActual(null);
    getMisLigas(currentProfile.id).then(ligas => {
      setMisLigas(ligas);
      if (ligas.length === 0) setScreen('sinligas');
      else setScreen('selector'); // siempre selector, nunca saltar directo
    });
  }, [currentProfile]);

  const ligaNombre = ligaActual?.nombre || 'Mis ligas';
  const planObj = getPlan(currentProfile);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="topbar-logo">🏐</span>
          {ligaActual ? (
            <>
              <button
                onClick={volverASelector}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '.35rem',
                  color: 'var(--muted2)', fontSize: '.82rem', fontWeight: 600,
                  padding: '.3rem .5rem', borderRadius: 'var(--radius-sm)',
                  transition: 'color .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--text)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--muted2)'}
              >
                <span style={{ fontSize: '.9rem' }}>‹</span> Mis ligas
              </button>
              <span style={{ color: 'var(--border2)', fontSize: '.9rem' }}>/</span>
              <span className="topbar-title" style={{ cursor: 'default' }}>
                {ligaNombre}
              </span>
            </>
          ) : (
            <span className="topbar-title">{ligaNombre}</span>
          )}
        </div>
        <div className="topbar-right">
          <span className="topbar-user">{currentProfile?.nombre || currentProfile?.email}</span>
          <button className="btn secondary small" onClick={handleLogout}>Salir</button>
        </div>
      </header>
      <main id="org-main">
        {screen === 'loading'  && <div className="loading-spinner" style={{ margin: '4rem auto' }} />}
        {screen === 'sinligas' && <SinLigas onCrear={irACrear} />}
        {screen === 'selector' && misLigas && (
          <SelectorLigas ligas={misLigas} onSeleccionar={abrirLiga} onCrear={irACrear} />
        )}
        {screen === 'crear' && (
          <FormCrearLiga perfil={currentProfile} onCreada={abrirLiga} onCancelar={volverASelector} />
        )}
        {screen === 'liga' && ligaActual && (
          <LigaPanel
            ligaInicial={ligaActual}
            onVolver={volverASelector}
            onNombreChange={nombre => setLigaActual(l => ({ ...l, nombre }))}
          />
        )}
      </main>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  PANTALLAS DE SELECCIÓN
// ════════════════════════════════════════════════════════════
function SinLigas({ onCrear }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">🏐</div>
      <h2>No tienes ligas aún</h2>
      <p className="muted">Crea tu primera liga para empezar.</p>
      <button className="btn" onClick={onCrear}>+ Crear mi primera liga</button>
    </div>
  );
}

function SelectorLigas({ ligas, onSeleccionar, onCrear }) {
  const { maxLigasPermitidas } = useAuth();
  const ownCount = ligas.filter(l => l.miRol === 'owner').length;
  const puedeCrear = ownCount < maxLigasPermitidas;

  return (
    <div className="ligas-selector">
      <h2>Mis ligas</h2>
      <div className="ligas-grid">
        {ligas.map(l => (
          <div key={l.id} className="liga-card" onClick={() => onSeleccionar(l)}>
            <div className="liga-card-nombre">{l.nombre}</div>
            <div className="liga-card-temp muted">{l.temporada || ''}</div>
            <div className="liga-card-codigo"><code>{l.codigo}</code></div>
            <span className={`badge ${l.miRol === 'owner' ? 'win' : 'pending'}`}>
              {l.miRol === 'owner' ? 'Propietario' : 'Co-admin'}
            </span>
          </div>
        ))}
        {puedeCrear && (
          <div className="liga-card nueva" onClick={onCrear}>
            <div className="liga-card-nombre">+ Nueva liga</div>
          </div>
        )}
        {!puedeCrear && (
          <div className="liga-card nueva" onClick={onCrear} title="Ver opciones para más ligas">
            <div className="liga-card-nombre">🔒 Más ligas</div>
            <div className="liga-card-temp muted" style={{ fontSize: '.75rem' }}>
              Límite del plan alcanzado
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  FORMULARIO CREAR LIGA
// ════════════════════════════════════════════════════════════
function FormCrearLiga({ perfil, onCreada, onCancelar }) {
  const { plan, maxLigasPermitidas } = useAuth();
  const [nombre,  setNombre]  = useState('');
  const [temp,    setTemp]    = useState('');
  const [error,   setError]   = useState('');
  const [limite,  setLimite]  = useState(false);
  const [conteo,  setConteo]  = useState(0);
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(true);
  const [mostrarPago, setMostrarPago] = useState(false);

  useEffect(() => {
    contarLigasDeUsuario(perfil.id).then(n => {
      setConteo(n);
      setLimite(n >= maxLigasPermitidas);
      setLoading(false);
    });
  }, [perfil.id, maxLigasPermitidas]);

  const enviar = async e => {
    e.preventDefault();
    setError('');
    try {
      const liga = await crearLiga({
        nombre,
        temporada: temp,
        ownerId: perfil.id,
        config: {},
        reglas: [],
        playoffsCfg: {},
      });
      toast('Liga creada ✓');
      onCreada(liga);
    } catch (err) {
      setError(err.message);
    }
  };

  const enviarPeticion_ = async e => {
    e.preventDefault();
    if (!mensaje.trim()) { toast('Escribe un mensaje', 'error'); return; }
    try {
      await enviarPeticion(perfil.id, mensaje);
      toast('Petición enviada ✓');
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  if (loading) return <div className="loading-spinner" style={{ margin: '4rem auto' }} />;

  // Límite alcanzado
  if (limite) {
    const siguientePlan = plan === 'basico' ? 'Medio' : plan === 'medio' ? 'Top' : null;

    return (
      <>
        {mostrarPago && <ModalPago onCerrar={() => setMostrarPago(false)} />}
        <div className="empty-state">
          <div className="empty-icon">⚠️</div>
          <h2>Límite de ligas alcanzado</h2>
          <p className="muted" style={{ marginBottom: '1rem' }}>
            Tu plan <strong>{plan.charAt(0).toUpperCase() + plan.slice(1)}</strong> permite
            hasta <strong>{maxLigasPermitidas} {maxLigasPermitidas === 1 ? 'liga' : 'ligas'}</strong> activas
            y ya tienes {conteo}.
          </p>

          {siguientePlan && (
            <div className="card" style={{ textAlign: 'left', maxWidth: 400, margin: '0 auto 1.2rem' }}>
              <p className="card-subtitle">Actualiza al plan {siguientePlan}</p>
              {siguientePlan === 'Medio' && (
                <p style={{ fontSize: '.88rem', color: 'var(--text2)', marginBottom: '1rem' }}>
                  Plan Medio te da hasta <strong>2 ligas</strong> + playoffs + finanzas + vista pública.
                </p>
              )}
              {siguientePlan === 'Top' && (
                <p style={{ fontSize: '.88rem', color: 'var(--text2)', marginBottom: '1rem' }}>
                  Plan Top te da hasta <strong>3 ligas</strong> + todas las funciones desbloqueadas.
                </p>
              )}
              <button className="btn" style={{ width: '100%' }} onClick={() => setMostrarPago(true)}>
                🚀 Ver planes
              </button>
            </div>
          )}

          {!siguientePlan && (
            <>
              <p className="muted" style={{ marginBottom: '1rem' }}>
                Estás en el plan máximo. Envía una petición al administrador si necesitas más ligas.
              </p>
              <form onSubmit={enviarPeticion_} style={{ maxWidth: 400, margin: '0 auto' }}>
                <textarea
                  rows={3}
                  style={{ width: '100%', padding: '.6rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
                  placeholder="¿Por qué necesitas más ligas?"
                  value={mensaje}
                  onChange={e => setMensaje(e.target.value)}
                />
                <button type="submit" className="btn" style={{ marginTop: '.6rem' }}>Enviar petición</button>
              </form>
            </>
          )}

          <button className="btn secondary" style={{ marginTop: '1rem' }} onClick={onCancelar}>
            Cancelar
          </button>
        </div>
      </>
    );
  }

  // Formulario normal
  return (
    <div className="empty-state" style={{ maxWidth: 480 }}>
      <h2>Nueva liga</h2>
      <p className="muted" style={{ marginBottom: '1.2rem', fontSize: '.85rem' }}>
        Usarás {conteo + 1} de {maxLigasPermitidas} liga{maxLigasPermitidas > 1 ? 's' : ''} de tu plan.
      </p>
      <form onSubmit={enviar}>
        <div className="auth-field">
          <label>Nombre de la liga *</label>
          <input
            type="text"
            placeholder="Liga Voleibol 2025"
            required
            maxLength={60}
            value={nombre}
            onChange={e => setNombre(e.target.value)}
          />
        </div>
        <div className="auth-field">
          <label>Temporada / Año</label>
          <input
            type="text"
            placeholder="2025"
            maxLength={20}
            value={temp}
            onChange={e => setTemp(e.target.value)}
          />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <div className="flex" style={{ gap: '.6rem', marginTop: '1rem' }}>
          <button type="submit" className="btn">Crear liga</button>
          <button type="button" className="btn secondary" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  PANEL DE LIGA
// ════════════════════════════════════════════════════════════
const TABS = [
  { id: 'tabla',       label: 'Tabla'           },
  { id: 'fixture',     label: 'Fixture'         },
  { id: 'partidos',    label: 'Partidos'        },
  { id: 'equipos',     label: 'Equipos'         },
  { id: 'playoffs',    label: '🏆 Playoffs',    requiere: 'puedePlayoffs'    },
  { id: 'finanzas',    label: '💰 Finanzas',    requiere: 'puedeFinanzas'    },
  { id: 'comentarios', label: '💬 Comentarios', requiere: 'puedeComentarios' },
  { id: 'config',      label: '⚙ Config'       },
];

function LigaPanel({ ligaInicial, onVolver, onNombreChange }) {
  const { puedePlayoffs, puedeFinanzas, puedeComentarios } = useAuth();
  const [activeTab, setActiveTab] = useState('tabla');
  const [liga,      setLiga]      = useState(null);
  const [equipos,   setEquipos]   = useState([]);
  const [partidos,  setPartidos]  = useState([]);
  const [loading,   setLoading]   = useState(true);

  const cargar = useCallback(async (ligaId = ligaInicial.id) => {
    const [l, eqs, pts] = await Promise.all([
      getLigaById(ligaId),
      getEquipos(ligaId),
      getPartidos(ligaId),
    ]);
    setLiga(l); setEquipos(eqs); setPartidos(pts); setLoading(false);
    try {
      await saveSnapshot(l.id, { liga: l, equipos: eqs, partidos: pts });
      const key = (l.alias || l.codigo).toLowerCase();
      await saveSnapshot('codigo:' + key, { ligaId: l.id, liga: l, equipos: eqs, partidos: pts });
    } catch (_) {}
  }, [ligaInicial.id]);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (liga?.nombre) onNombreChange(liga.nombre); }, [liga?.nombre]);

  const refresh    = useCallback(() => cargar(liga?.id || ligaInicial.id), [cargar, liga?.id]);
  const updateLiga = useCallback(cambios => {
    setLiga(prev => ({ ...prev, ...cambios }));
    if (cambios.nombre) onNombreChange(cambios.nombre);
  }, [onNombreChange]);

  if (loading) return <div className="loading-spinner" style={{ margin: '4rem auto' }} />;
  if (!liga)   return <p className="empty">Error cargando la liga.</p>;

  const tabBloqueado = (tab) => {
    if (!tab.requiere) return false;
    if (tab.requiere === 'puedePlayoffs'    && !puedePlayoffs)    return true;
    if (tab.requiere === 'puedeFinanzas'    && !puedeFinanzas)    return true;
    if (tab.requiere === 'puedeComentarios' && !puedeComentarios) return true;
    return false;
  };

  const tabProps = { liga, equipos, partidos, refresh, updateLiga };

  return (
    <>
      <nav className="tab-nav">
        {TABS.map(t => {
          const bloqueado = tabBloqueado(t);
          return (
            <button
              key={t.id}
              className={activeTab === t.id ? 'active' : ''}
              onClick={() => setActiveTab(bloqueado ? 'upgrade' : t.id)}
              title={bloqueado ? 'Disponible en un plan superior' : ''}
            >
              {t.label}{bloqueado ? ' 🔒' : ''}
            </button>
          );
        })}
      </nav>
      <section className="section">
        {activeTab === 'upgrade'     && <TabUpgrade />}
        {activeTab === 'tabla'       && <TabTabla      {...tabProps} />}
        {activeTab === 'fixture'     && <TabFixture    {...tabProps} />}
        {activeTab === 'partidos'    && <TabPartidos   {...tabProps} />}
        {activeTab === 'equipos'     && <TabEquipos    {...tabProps} />}
        {activeTab === 'playoffs'    && <TabPlayoffs   liga={liga} equipos={equipos} partidos={partidos} refresh={refresh} />}
        {activeTab === 'finanzas'    && <TabFinanzas   {...tabProps} />}
        {activeTab === 'comentarios' && <TabComentarios liga={liga} />}
        {activeTab === 'config'      && (
          <TabConfig
            {...tabProps}
            onEliminar={async () => {
              if (!window.confirm('Eliminar la liga "' + liga.nombre + '"? Esta acción no se puede deshacer.')) return;
              try {
                await eliminarLiga(liga.id);
                localStorage.removeItem('ligaActualId');
                toast('Liga eliminada');
                onVolver();
              } catch (err) {
                toast(err.message, 'error');
              }
            }}
            onCrearNueva={onVolver}
          />
        )}
      </section>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  TAB UPGRADE
// ════════════════════════════════════════════════════════════
function TabUpgrade() {
  const [mostrarPago, setMostrarPago] = useState(false);
  const { plan } = useAuth();
  const esMedio = plan === 'medio';

  return (
    <>
      {mostrarPago && <ModalPago onCerrar={() => setMostrarPago(false)} />}
      <div className="empty-state" style={{ maxWidth: 480 }}>
        <div className="empty-icon">🔒</div>
        <h2>Función <span>{esMedio ? 'Top' : 'de pago'}</span></h2>
        <p className="muted" style={{ marginBottom: '1.5rem' }}>
          {esMedio
            ? 'Esta función está disponible en el Plan Top.'
            : 'Esta función requiere un plan de pago.'
          }
        </p>

        {plan === 'basico' && (
          <div className="card" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            <p className="card-subtitle">Plan Medio incluye</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', fontSize: '.88rem' }}>
              <span>⚡ 2 ligas activas</span>
              <span>✅ Vista pública incluida</span>
              <span>✅ Bracket de playoffs</span>
              <span>✅ Módulo de finanzas</span>
              <span>✅ Equipos ilimitados</span>
            </div>
            <p style={{ marginTop: '.8rem', fontSize: '.82rem', color: 'var(--accent)' }}>
              Desde $99 MXN/mes
            </p>
          </div>
        )}

        {plan === 'medio' && (
          <div className="card" style={{ textAlign: 'left', marginBottom: '1.5rem' }}>
            <p className="card-subtitle">Plan Top incluye además</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', fontSize: '.88rem' }}>
              <span>🏆 3 ligas activas</span>
              <span>✅ Co-administradores</span>
              <span>✅ Alias personalizado</span>
              <span>✅ Diseño de vista pública</span>
              <span>✅ Comentarios y sugerencias</span>
            </div>
            <p style={{ marginTop: '.8rem', fontSize: '.82rem', color: 'var(--accent)' }}>
              Desde $149 MXN/mes
            </p>
          </div>
        )}

        <button
          className="btn"
          style={{ width: '100%', padding: '.8rem', fontSize: '1rem' }}
          onClick={() => setMostrarPago(true)}
        >
          🚀 Ver planes y precios
        </button>
        <p className="muted" style={{ fontSize: '.78rem', marginTop: '.8rem' }}>
          Sin renovación automática · Pago seguro con MercadoPago
        </p>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  TAB TABLA
// ════════════════════════════════════════════════════════════
export function TabTabla({ liga, equipos = [], partidos = [] }) {
  const cfg       = liga.config || {};
  const usarPts   = cfg.usarPuntos  !== false;
  const usarSets  = cfg.usarSets    !== false;
  const mostrarDS = usarSets && cfg.mostrarColDifSets !== false;
  const tabla     = calcularTabla(equipos, partidos, cfg);
  const tablaRef  = useRef(null);

  const exportar = async () => {
    try {
      const { default: html2canvas } = await import('html2canvas');
      const canvas = await html2canvas(tablaRef.current, { backgroundColor: '#0f172a', scale: 2 });
      const link = document.createElement('a');
      link.download = 'tabla-' + liga.nombre + '.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast('Imagen descargada');
    } catch { toast('Error al exportar imagen', 'error'); }
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.5rem' }}>
        <h2 style={{ margin: 0 }}>Tabla de <span>Posiciones</span></h2>
        <button className="btn secondary small" style={{ marginLeft: 'auto' }} onClick={exportar}>
          Exportar imagen
        </button>
      </div>
      <div ref={tablaRef} className="tabla-wrap">
        <table className="tabla-pos">
          <thead>
            <tr>
              <th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th>
              {usarSets && <><th>SG</th><th>SP</th></>}
              {mostrarDS && <th>DS</th>}
              {usarPts && <th>PTS</th>}
            </tr>
          </thead>
          <tbody>
            {tabla.map((r, i) => {
              const ds = r.sg - r.sp;
              return (
                <tr key={r.equipo}>
                  <td>{i + 1}</td><td>{r.equipo}</td><td>{r.pj}</td>
                  <td className="green">{r.pg}</td><td className="red">{r.pp}</td>
                  {usarSets && <><td>{r.sg}</td><td>{r.sp}</td></>}
                  {mostrarDS && <td className={ds > 0 ? 'green' : ds < 0 ? 'red' : ''}>{ds > 0 ? '+' : ''}{ds}</td>}
                  {usarPts && <td className="pts-cell">{r.pts}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  TAB FIXTURE
// ════════════════════════════════════════════════════════════
export function TabFixture({ liga, equipos = [], partidos = [] }) {
  const cfg     = liga.config || {};
  const vueltas = cfg.vueltas || 2;
  const noms    = equipos.map(e => e.nombre);
  const fixture = generarFixture(noms);

  return (
    <>
      <h2>Fixture</h2>
      {Array.from({ length: vueltas }, (_, idx) => {
        const v = idx + 1;
        const encuentros = fixture.map((enc, i) => {
          const eA = v === 1 ? enc.local : enc.visitante;
          const eB = v === 1 ? enc.visitante : enc.local;
          const p  = partidos.find(x =>
            !x.es_playoff && x.vuelta === v &&
            ((x.equipo_a === eA && x.equipo_b === eB) || (x.equipo_a === eB && x.equipo_b === eA))
          );
          return { eA, eB, p, i };
        });
        const pendientes = encuentros.filter(e => !e.p?.jugado);
        const jugados    = encuentros.filter(e =>  e.p?.jugado);
        const ordenados  = [...pendientes, ...jugados];
        return (
          <div key={v}>
            <h3 style={{ marginTop: '1.2rem' }}>
              Vuelta {v}
              {pendientes.length > 0 && (
                <span className="badge pending" style={{ marginLeft: '.6rem', fontSize: '.72rem' }}>
                  {pendientes.length} pendiente{pendientes.length !== 1 ? 's' : ''}
                </span>
              )}
              {pendientes.length === 0 && jugados.length > 0 && (
                <span className="badge win" style={{ marginLeft: '.6rem', fontSize: '.72rem' }}>Completa</span>
              )}
            </h3>
            <div className="fixture-list">
              {ordenados.map(({ eA, eB, p, i }) => (
                <div key={i} className={'fixture-item ' + (p?.jugado ? 'jugado' : '')}>
                  <span className={'badge ' + (v === 1 ? 'pending' : 'done')}>V{v}</span>
                  <div className="fixture-teams">
                    <span className={p?.ganador === 'A' ? 'team-win' : ''}>{eA}</span>
                    <span className="fixture-vs">{p?.jugado ? p.sets_a + ':' + p.sets_b : 'vs'}</span>
                    <span className={p?.ganador === 'B' ? 'team-win' : ''}>{eB}</span>
                  </div>
                  {p?.fecha && <span className="fixture-date">{formatFecha(p.fecha)}</span>}
                  {p?.jugado && <span className="badge win">🏆 {p.ganador === 'A' ? eA : eB}</span>}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  TAB PARTIDOS
// ════════════════════════════════════════════════════════════
const REGLAS_DEFAULT = [
  { nombre: 'Set 1', puntos: 25, diferencia: 2, usarPuntosSet: true },
  { nombre: 'Set 2', puntos: 25, diferencia: 2, usarPuntosSet: true },
  { nombre: 'Set 3 (desempate)', puntos: 15, diferencia: 2, usarPuntosSet: true },
];

export function TabPartidos({ liga, equipos = [], partidos = [], refresh }) {
  const cfg      = liga.config || {};
  const usarSets = cfg.usarSets !== false;
  const reglas   = liga.reglas?.length ? liga.reglas : REGLAS_DEFAULT;
  const norm     = partidos.filter(p => !p.es_playoff);

  const [vuelta,    setVuelta]    = useState(1);
  const [fecha,     setFecha]     = useState('');
  const [eqA,       setEqA]       = useState('');
  const [eqB,       setEqB]       = useState('');
  const [ganSimple, setGanSimple] = useState('');
  const [sets,      setSets]      = useState(() => reglas.map(() => ({ a: '', b: '' })));

  const handleSubmit = async e => {
    e.preventDefault();
    if (!eqA || !eqB) { toast('Selecciona ambos equipos', 'error'); return; }
    if (eqA === eqB)  { toast('Los equipos deben ser diferentes', 'error'); return; }
    if (!fecha)       { toast('La fecha es obligatoria', 'error'); return; }

    let setsData = [], sA = 0, sB = 0, ganador = null;

    if (!usarSets) {
      if (!ganSimple) { toast('Selecciona quién ganó', 'error'); return; }
      ganador = ganSimple;
      sA = ganador === 'A' ? 1 : 0;
      sB = ganador === 'B' ? 1 : 0;
    } else {
      const res = leerSets(sets, reglas);
      if (!res.ok) { toast(res.msg, 'error'); return; }
      setsData = res.sets; sA = res.sA; sB = res.sB; ganador = res.ganador;
    }

    const existe = partidos.some(p =>
      !p.es_playoff && p.vuelta === vuelta &&
      ((p.equipo_a === eqA && p.equipo_b === eqB) || (p.equipo_a === eqB && p.equipo_b === eqA))
    );
    if (existe) { toast('Ya existe este partido en esa vuelta', 'error'); return; }

    try {
      const precioArb   = liga.config?.precioArbitraje ?? 120;
      const equipoAData = equipos.find(e => e.nombre === eqA);
      const equipoBData = equipos.find(e => e.nombre === eqB);
      const saldoA      = equipoAData?.arb_saldo || 0;
      const saldoB      = equipoBData?.arb_saldo || 0;
      const pagoA       = saldoA >= precioArb;
      const pagoB       = saldoB >= precioArb;

      const guardado = await guardarPartido(liga.id, {
        vuelta, fecha, equipo_a: eqA, equipo_b: eqB,
        sets: setsData, sets_a: sA, sets_b: sB, ganador, jugado: true,
        pago_arb_a: pagoA,
        pago_arb_b: pagoB,
      });

      if (pagoA && equipoAData) await actualizarEquipo(equipoAData.id, { arb_saldo: saldoA - precioArb });
      if (pagoB && equipoBData) await actualizarEquipo(equipoBData.id, { arb_saldo: saldoB - precioArb });

      const cubiertos = [pagoA ? eqA : null, pagoB ? eqB : null].filter(Boolean);
      const extra = cubiertos.length ? ' — Cubierto con saldo: ' + cubiertos.join(', ') : '';
      toast(eqA + ' ' + sA + ':' + sB + ' ' + eqB + extra);
      await notifyDesdePartidoGuardado(liga, guardado);
      setFecha(''); setEqA(''); setEqB(''); setGanSimple('');
      setSets(reglas.map(() => ({ a: '', b: '' })));
      refresh();
    } catch (err) { toast(err.message, 'error'); }
  };

  const eliminar = async id => {
    if (!window.confirm('¿Eliminar este partido?')) return;
    await eliminarPartido(id); refresh(); toast('Partido eliminado');
  };

  return (
    <>
      <h2>Registrar <span>Partido</span></h2>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Vuelta</label>
              <select value={vuelta} onChange={e => setVuelta(parseInt(e.target.value))}>
                {Array.from({ length: cfg.vueltas || 2 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>Vuelta {i + 1}</option>
                ))}
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
                <option value="">Seleccionar</option>
                {equipos.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Equipo B</label>
              <select value={eqB} onChange={e => setEqB(e.target.value)}>
                <option value="">Seleccionar</option>
                {equipos.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
              </select>
            </div>
          </div>
          <div style={{ marginTop: '1rem' }}>
            {!usarSets ? (
              <div className="set-block">
                <h4>Resultado</h4>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.4rem', cursor: 'pointer' }}>
                  <input type="radio" name="gan-simple" value="A" checked={ganSimple === 'A'} onChange={() => setGanSimple('A')} />
                  Equipo A gana
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer' }}>
                  <input type="radio" name="gan-simple" value="B" checked={ganSimple === 'B'} onChange={() => setGanSimple('B')} />
                  Equipo B gana
                </label>
              </div>
            ) : (
              <div className="sets-grid">
                {reglas.map((r, i) => {
                  const esDesempate   = i === reglas.length - 1 && reglas.length > 1;
                  const setsParaGanar = Math.ceil(reglas.length / 2);
                  if (esDesempate) {
                    let sA = 0, sB = 0, todosCompletos = true;
                    for (let j = 0; j < i; j++) {
                      const pA = parseInt(sets[j]?.a), pB = parseInt(sets[j]?.b);
                      if (isNaN(pA) || isNaN(pB)) { todosCompletos = false; break; }
                      if (pA > pB) sA++; else sB++;
                    }
                    if (!todosCompletos || sA !== sB) return null;
                  } else {
                    let sA = 0, sB = 0;
                    for (let j = 0; j < i; j++) {
                      const pA = parseInt(sets[j]?.a), pB = parseInt(sets[j]?.b);
                      if (!isNaN(pA) && !isNaN(pB)) { if (pA > pB) sA++; else sB++; }
                    }
                    if (sA >= setsParaGanar || sB >= setsParaGanar) return null;
                  }
                  const conPts = r.usarPuntosSet !== false;
                  return (
                    <div key={i} className="set-block">
                      <h4>
                        {r.nombre}
                        {esDesempate && <small style={{ color: 'var(--accent)', fontSize: '.7rem' }}> (Desempate)</small>}
                      </h4>
                      <div className="set-score">
                        <input type="number" min={0} max={999} placeholder="Eq A" value={sets[i]?.a || ''}
                          onChange={e => setSets(prev => prev.map((s, j) => j === i ? { ...s, a: e.target.value } : s))} />
                        <span>—</span>
                        <input type="number" min={0} max={999} placeholder="Eq B" value={sets[i]?.b || ''}
                          onChange={e => setSets(prev => prev.map((s, j) => j === i ? { ...s, b: e.target.value } : s))} />
                      </div>
                      <p className="note">{conPts ? 'Min ' + r.puntos + ' Dif >= ' + r.diferencia : 'Solo ganador'}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="flex mt1">
            <button type="submit" className="btn">Guardar partido</button>
            <button type="reset" className="btn secondary"
              onClick={() => { setFecha(''); setEqA(''); setEqB(''); setGanSimple(''); setSets(reglas.map(() => ({ a: '', b: '' }))); }}>
              Limpiar
            </button>
          </div>
        </form>
      </div>

      <h2 style={{ marginTop: '2rem' }}>Partidos <span>Registrados</span></h2>
      {!norm.length
        ? <p className="empty">No hay partidos aún.</p>
        : [...norm].sort((a, b) => a.vuelta - b.vuelta).map(p => {
          const ganN = p.ganador === 'A' ? p.equipo_a : p.equipo_b;
          return (
            <div key={p.id} className="fixture-item">
              <span className={'badge ' + (p.vuelta === 1 ? 'pending' : 'done')}>V{p.vuelta}</span>
              <div className="fixture-teams">
                <span>{p.equipo_a}</span>
                <span className="fixture-vs">{usarSets ? p.sets_a + ':' + p.sets_b : 'G:P'}</span>
                <span>{p.equipo_b}</span>
              </div>
              {p.fecha && <span className="fixture-date">{formatFecha(p.fecha)}</span>}
              <span className="badge win">🏆 {ganN}</span>
              <button className="btn danger small" onClick={() => eliminar(p.id)}>Eliminar</button>
            </div>
          );
        })
      }
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  TAB EQUIPOS
// ════════════════════════════════════════════════════════════
export function TabEquipos({ liga, equipos = [], refresh }) {
  const [nombre, setNombre] = useState('');

  const agregar = async () => {
    const nom = nombre.trim();
    if (!nom) { toast('Escribe un nombre', 'error'); return; }
    if (equipos.some(e => e.nombre.toLowerCase() === nom.toLowerCase())) {
      toast('Nombre duplicado', 'error'); return;
    }
    await agregarEquipo(liga.id, nom);
    setNombre(''); refresh(); toast('Equipo agregado');
  };

  const eliminar = async id => {
    if (!window.confirm('¿Eliminar este equipo?')) return;
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
        {!equipos.length
          ? <p className="empty">No hay equipos registrados.</p>
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

// ════════════════════════════════════════════════════════════
//  TAB FINANZAS
// ════════════════════════════════════════════════════════════
export function TabFinanzas({ liga, equipos = [], partidos = [], refresh }) {
  const cfg      = liga.config || {};
  const precioI  = cfg.precioInscripcion ?? 500;
  const precioA  = cfg.precioArbitraje   ?? 120;
  const permitirAdelanto = cfg.permitirAdelantoArb !== false;
  const norm     = partidos.filter(p => !p.es_playoff && p.jugado);
  const inscPag  = equipos.filter(e => e.inscripcion_pagada).length;
  const inscPend = equipos.length - inscPag;

  const arbCobPartidos = norm.reduce((s, p) =>
    s + (p.pago_arb_a ? precioA : 0) + (p.pago_arb_b ? precioA : 0), 0);

  const arbCubiertosPorSaldo = equipos.reduce((suma, eq) => {
    const pend = norm.filter(p =>
      (p.equipo_a === eq.nombre && !p.pago_arb_a) ||
      (p.equipo_b === eq.nombre && !p.pago_arb_b)
    ).length;
    return suma + Math.min(eq.arb_saldo || 0, pend * precioA);
  }, 0);

  const arbCobTotal = arbCobPartidos + arbCubiertosPorSaldo;

  const arbPendTotal = equipos.reduce((suma, eq) => {
    const pend = norm.filter(p =>
      (p.equipo_a === eq.nombre && !p.pago_arb_a) ||
      (p.equipo_b === eq.nombre && !p.pago_arb_b)
    ).length;
    return suma + Math.max(0, pend * precioA - (eq.arb_saldo || 0));
  }, 0);

  const arbSaldoLibreTotal = equipos.reduce((suma, eq) => {
    const pend = norm.filter(p =>
      (p.equipo_a === eq.nombre && !p.pago_arb_a) ||
      (p.equipo_b === eq.nombre && !p.pago_arb_b)
    ).length;
    return suma + Math.max(0, (eq.arb_saldo || 0) - pend * precioA);
  }, 0);

  const pagarInscripcion = async id => {
    if (!window.confirm('¿Confirmar pago de inscripción?')) return;
    await actualizarEquipo(id, { inscripcion_pagada: true });
    refresh(); toast('Inscripción registrada');
  };

  const pagarArb = async (id, campo) => {
    await actualizarPartido(id, { [campo]: true });
    refresh(); toast('Arbitraje registrado');
  };

  return (
    <>
      <h2>💰 <span>Finanzas</span></h2>
      <div className="resumen-financiero">
        <div className="resumen-fin-grid">
          <div className="resumen-fin-card total">
            <div className="resumen-fin-val">${((inscPag * precioI) + arbCobTotal).toLocaleString('es-MX')}</div>
            <div className="resumen-fin-lbl">Total cobrado</div>
          </div>
          <div className="resumen-fin-card">
            <div className="resumen-fin-val">${(inscPag * precioI).toLocaleString('es-MX')}</div>
            <div className="resumen-fin-lbl">Inscripciones {inscPag}/{equipos.length}</div>
            {inscPend > 0
              ? <div className="resumen-fin-pend">Pendiente ${(inscPend * precioI).toLocaleString('es-MX')}</div>
              : <div className="resumen-fin-ok">✓</div>}
          </div>
          <div className="resumen-fin-card">
            <div className="resumen-fin-val">${arbCobTotal.toLocaleString('es-MX')}</div>
            <div className="resumen-fin-lbl">Arbitrajes cobrados</div>
            {arbPendTotal > 0
              ? <div className="resumen-fin-pend">Pendiente ${arbPendTotal.toLocaleString('es-MX')}</div>
              : <div className="resumen-fin-ok">Al corriente</div>}
          </div>
          {permitirAdelanto && (
            <div className="resumen-fin-card">
              <div className="resumen-fin-val" style={{ color: arbSaldoLibreTotal > 0 ? '#10b981' : 'var(--muted)' }}>
                {'$' + arbSaldoLibreTotal.toLocaleString('es-MX')}
              </div>
              <div className="resumen-fin-lbl">Saldo adelantado en caja</div>
              {arbSaldoLibreTotal > 0
                ? <div className="resumen-fin-ok">Cubre futuros partidos</div>
                : <div className="resumen-fin-ok">Sin saldo en caja</div>}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: '1.2rem' }}>
        <p className="card-subtitle">📋 Inscripciones</p>
        {equipos.map(e => (
          <div key={e.id} className={'arb-pill ' + (e.inscripcion_pagada ? 'pagado' : 'pendiente')} style={{ marginBottom: '.5rem' }}>
            <span className="arb-pill-nom">{e.nombre}</span>
            <small className="muted">${precioI.toLocaleString('es-MX')}</small>
            {e.inscripcion_pagada
              ? <span className="arb-pill-estado">Pagado</span>
              : <button className="arb-pill-btn" onClick={() => pagarInscripcion(e.id)}>Marcar pagado</button>}
          </div>
        ))}
      </div>

      {permitirAdelanto && (
        <div className="card" style={{ marginTop: '1.2rem' }}>
          <p className="card-subtitle">💸 Arbitrajes por equipo</p>
          <p className="muted" style={{ fontSize: '.8rem', marginBottom: '1rem' }}>
            Registra cualquier monto. El sobrante queda como saldo a favor y se aplica a próximos partidos.
          </p>
          {equipos.map(eq => (
            <PagoEquipo key={eq.id} eq={eq} partidos={partidos} liga={liga} precioA={precioA} refresh={refresh} />
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: '1.2rem' }}>
        <p className="card-subtitle">Detalle por partido</p>
        {!norm.length
          ? <p className="muted">Sin partidos jugados aún.</p>
          : [...norm].sort((a, b) => {
              const aPend = (!a.pago_arb_a || !a.pago_arb_b) ? 0 : 1;
              const bPend = (!b.pago_arb_a || !b.pago_arb_b) ? 0 : 1;
              if (aPend !== bPend) return aPend - bPend;
              return a.vuelta - b.vuelta;
            }).map(p => (
            <div key={p.id} className="fixture-item" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '.4rem' }}>
              <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className={'badge ' + (p.vuelta === 1 ? 'pending' : 'done')}>V{p.vuelta}</span>
                <span><strong>{p.equipo_a}</strong> vs <strong>{p.equipo_b}</strong></span>
                {p.fecha && <span className="fixture-date">{formatFecha(p.fecha)}</span>}
              </div>
              <div className="arb-row" style={{ width: '100%' }}>
                <div className={'arb-pill ' + (p.pago_arb_a ? 'pagado' : 'pendiente')}>
                  <span className="arb-pill-nom">{p.equipo_a}</span>
                  {p.pago_arb_a
                    ? <span className="arb-pill-estado">Pagado</span>
                    : <button className="arb-pill-btn" onClick={() => pagarArb(p.id, 'pago_arb_a')}>Pagar ${precioA}</button>}
                </div>
                <div className={'arb-pill ' + (p.pago_arb_b ? 'pagado' : 'pendiente')}>
                  <span className="arb-pill-nom">{p.equipo_b}</span>
                  {p.pago_arb_b
                    ? <span className="arb-pill-estado">Pagado</span>
                    : <button className="arb-pill-btn" onClick={() => pagarArb(p.id, 'pago_arb_b')}>Pagar ${precioA}</button>}
                </div>
              </div>
            </div>
          ))
        }
      </div>
    </>
  );
}

function PagoEquipo({ eq, partidos = [], liga, precioA, refresh }) {
  const [open,  setOpen]  = useState(false);
  const [monto, setMonto] = useState('');

  const norm = partidos.filter(p => !p.es_playoff && p.jugado);

  const pendientes = norm.filter(p =>
    (p.equipo_a === eq.nombre && !p.pago_arb_a) ||
    (p.equipo_b === eq.nombre && !p.pago_arb_b)
  ).sort((a, b) => (a.fecha || '').localeCompare(b.fecha || ''));

  const jugPend       = pendientes.length;
  const deudaBruta    = jugPend * precioA;
  const saldo         = eq.arb_saldo || 0;
  const pendienteNeto = Math.max(0, deudaBruta - saldo);
  const saldoLibre    = Math.max(0, saldo - deudaBruta);

  const confirmar_ = async () => {
    const m = parseInt(monto);
    if (!m || m < 1) { toast('Ingresa un monto válido', 'error'); return; }
    let resto = saldo + m;
    for (const p of pendientes) {
      if (resto < precioA) break;
      const campo = p.equipo_a === eq.nombre ? 'pago_arb_a' : 'pago_arb_b';
      await actualizarPartido(p.id, { [campo]: true });
      resto -= precioA;
    }
    await actualizarEquipo(eq.id, { arb_saldo: resto });
    const extra = resto > 0 ? ' — Saldo a favor: $' + resto.toLocaleString('es-MX') : '';
    toast('$' + m.toLocaleString('es-MX') + ' registrado' + extra);
    setOpen(false); setMonto(''); refresh();
  };

  const aplicarSaldo = async () => {
    let resto = saldo;
    let cubiertos = 0;
    for (const p of pendientes) {
      if (resto < precioA) break;
      const campo = p.equipo_a === eq.nombre ? 'pago_arb_a' : 'pago_arb_b';
      await actualizarPartido(p.id, { [campo]: true });
      resto -= precioA;
      cubiertos++;
    }
    await actualizarEquipo(eq.id, { arb_saldo: resto });
    if (cubiertos > 0) {
      const pl = cubiertos !== 1;
      const restMsg = resto > 0 ? ' — $' + resto.toLocaleString('es-MX') + ' restante' : '';
      toast(cubiertos + ' partido' + (pl ? 's' : '') + ' cubierto' + (pl ? 's' : '') + ' con saldo' + restMsg);
    } else {
      toast('Saldo insuficiente para cubrir un arbitraje completo', 'error');
    }
    refresh();
  };

  const alCorriente      = jugPend === 0 && saldo === 0;
  const cubiertoPorSaldo = jugPend > 0 && pendienteNeto === 0;
  const puedeAplicarSaldo = saldo >= precioA && jugPend > 0 && !cubiertoPorSaldo;

  return (
    <div style={{
      background: 'var(--card2)', border: '1px solid var(--border2)',
      borderRadius: 'var(--radius)', padding: '.9rem 1rem', marginBottom: '.6rem',
    }}>
      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem', marginBottom: '.6rem' }}>
        {eq.nombre}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', flex: 1 }}>
          {jugPend > 0 && !cubiertoPorSaldo && (
            <span style={{ fontSize: '.8rem', color: 'var(--red)' }}>
              {jugPend} partido{jugPend !== 1 ? 's' : ''} sin pagar — ${deudaBruta.toLocaleString('es-MX')}
            </span>
          )}
          <span style={{ color: saldo > 0 ? '#10b981' : 'var(--muted)', fontSize: '.8rem' }}>
            {'Saldo: $' + saldo.toLocaleString('es-MX')}
            {saldoLibre > 0 && (' — $' + saldoLibre.toLocaleString('es-MX') + ' para futuros')}
          </span>
          {alCorriente      && <span className="badge win" style={{ alignSelf: 'flex-start' }}>Al corriente</span>}
          {cubiertoPorSaldo && <span className="badge win" style={{ alignSelf: 'flex-start' }}>Cubierto por saldo</span>}
          {!alCorriente && !cubiertoPorSaldo && jugPend > 0 && (
            <strong style={{ fontSize: '.88rem', color: 'var(--red)' }}>
              Pendiente: ${pendienteNeto.toLocaleString('es-MX')}
            </strong>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', flexShrink: 0 }}>
          {puedeAplicarSaldo && (
            <button className="btn" style={{ fontSize: '.8rem' }} onClick={aplicarSaldo}>
              Aplicar saldo
            </button>
          )}
          <button className="btn secondary" style={{ fontSize: '.8rem' }} onClick={() => setOpen(o => !o)}>
            Registrar pago
          </button>
        </div>
      </div>
      {open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', alignItems: 'center', marginTop: '.8rem', paddingTop: '.8rem', borderTop: '1px solid var(--border)' }}>
          <input type="number" min={1}
            style={{ width: 110, padding: '.3rem .5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)' }}
            value={monto} onChange={e => setMonto(e.target.value)}
            placeholder={String(pendienteNeto > 0 ? pendienteNeto : precioA)} />
          <button className="btn" style={{ fontSize: '.8rem' }} onClick={confirmar_}>Confirmar</button>
          <button className="btn secondary" style={{ fontSize: '.8rem' }} onClick={() => setOpen(false)}>Cancelar</button>
          <p className="muted" style={{ fontSize: '.74rem', marginTop: '.3rem', width: '100%' }}>
            El sobrante queda como saldo a favor de <strong>{eq.nombre}</strong>.
          </p>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  TAB COMENTARIOS
// ════════════════════════════════════════════════════════════
export function TabComentarios({ liga }) {
  const [comentarios, setComentarios] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const permitido = liga.config?.permitirComentarios !== false;

  const cargar = async () => {
    setLoading(true);
    const data = await getComentarios(liga.id);
    setComentarios(data); setLoading(false);
  };

  useEffect(() => { cargar(); }, [liga.id]);

  const eliminar = async id => {
    if (!window.confirm('¿Eliminar este comentario?')) return;
    try {
      await eliminarComentario(id);
      setComentarios(prev => prev.filter(c => c.id !== id));
      toast('Comentario eliminado');
    } catch (err) { toast(err.message, 'error'); }
  };

  const quejas      = comentarios.filter(c => c.tipo === 'queja');
  const sugerencias = comentarios.filter(c => c.tipo === 'sugerencia');

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '.8rem' }}>
        <h2 style={{ margin: 0 }}>💬 <span>Comentarios</span></h2>
        <button className="btn secondary small" onClick={cargar} style={{ marginLeft: 'auto' }}>Actualizar</button>
      </div>
      {!permitido && (
        <div className="auth-error" style={{ marginBottom: '1rem' }}>
          Los comentarios están deshabilitados. Puedes activarlos desde Config.
        </div>
      )}
      <p className="muted" style={{ fontSize: '.85rem', marginBottom: '1.2rem' }}>
        Quejas y sugerencias enviadas desde la vista pública.
        {permitido ? ' Elimina los que ya revisaste.' : ''}
      </p>
      {loading && <div className="loading-spinner" style={{ margin: '2rem auto' }} />}
      {!loading && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.6rem' }}>
              <span className="badge danger" style={{ fontSize: '.78rem' }}>Quejas</span>
              <span className="muted" style={{ fontSize: '.78rem' }}>{quejas.length}</span>
            </div>
            {!quejas.length
              ? <p className="empty" style={{ fontSize: '.85rem' }}>Sin quejas.</p>
              : quejas.map(c => (
                <div key={c.id} className="card" style={{ marginBottom: '.6rem', padding: '.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.4rem', marginBottom: '.4rem' }}>
                    <div>
                      <strong style={{ fontSize: '.85rem', display: 'block' }}>{c.autor}</strong>
                      <span className="fixture-date">{formatFecha(c.created_at?.slice(0, 10))}</span>
                    </div>
                    <button className="btn danger small" onClick={() => eliminar(c.id)} style={{ flexShrink: 0 }}>🗑</button>
                  </div>
                  {c.equipo      && <p style={{ fontSize: '.78rem', color: 'var(--accent)', marginBottom: '.3rem' }}>Equipo: {c.equipo}</p>}
                  {c.descripcion && <p style={{ fontSize: '.83rem', margin: '0 0 .25rem', color: 'var(--muted)' }}><strong>Descripción:</strong> {c.descripcion}</p>}
                  {c.mensaje     && <p style={{ fontSize: '.83rem', margin: 0, lineHeight: 1.5 }}>{c.mensaje}</p>}
                </div>
              ))
            }
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', marginBottom: '.6rem' }}>
              <span className="badge win" style={{ fontSize: '.78rem' }}>Sugerencias</span>
              <span className="muted" style={{ fontSize: '.78rem' }}>{sugerencias.length}</span>
            </div>
            {!sugerencias.length
              ? <p className="empty" style={{ fontSize: '.85rem' }}>Sin sugerencias.</p>
              : sugerencias.map(c => (
                <div key={c.id} className="card" style={{ marginBottom: '.6rem', padding: '.8rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '.4rem', marginBottom: '.4rem' }}>
                    <div>
                      <strong style={{ fontSize: '.85rem', display: 'block' }}>{c.autor}</strong>
                      <span className="fixture-date">{formatFecha(c.created_at?.slice(0, 10))}</span>
                    </div>
                    <button className="btn danger small" onClick={() => eliminar(c.id)} style={{ flexShrink: 0 }}>🗑</button>
                  </div>
                  <p style={{ fontSize: '.83rem', margin: 0, lineHeight: 1.5 }}>{c.mensaje}</p>
                </div>
              ))
            }
          </div>
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  TAB CONFIG
// ════════════════════════════════════════════════════════════
export function TabConfig({ liga, refresh, updateLiga, onEliminar, onCrearNueva }) {
  const { puedeAlias, puedeCoAdmins, planObj, puedeVerPublico, plan, currentProfile } = useAuth();
  const puedeDisenoPublico = planObj?.disenoPublico || false;

  const cfg0 = {
    nombre: liga.nombre || '', temporada: liga.temporada || '',
    vueltas: 2, usarPuntos: true, usarSets: true,
    ptsVictoria: 2, ptsBono: 1, ptsDerota: 0,
    precioInscripcion: 500, precioArbitraje: 120,
    permitirAdelantoArb: true, permitirComentarios: true,
    ...(liga.config || {}),
  };
  const [cfg,      setCfg]      = useState(cfg0);
  const [alias,    setAlias]    = useState(liga.alias || '');
  const [aliasMsg, setAliasMsg] = useState({ ok: '', err: '' });
  const [miembros, setMiembros] = useState([]);
  const [invEmail, setInvEmail] = useState('');
  const [mostrarPagoAddon, setMostrarPagoAddon] = useState(false);

  useEffect(() => { getMiembros(liga.id).then(setMiembros); }, [liga.id]);

  const guardarBasico = async e => {
    e.preventDefault();
    await actualizarLiga(liga.id, { nombre: cfg.nombre, temporada: cfg.temporada, config: cfg });
    updateLiga({ nombre: cfg.nombre, temporada: cfg.temporada, config: cfg });
    toast('Configuración guardada');
  };

  const guardarFormato = async () => {
    await actualizarLiga(liga.id, { config: cfg });
    toast('Formato guardado');
  };

  const guardarAlias_ = async () => {
    setAliasMsg({ ok: '', err: '' });
    try {
      if (!alias.trim()) {
        await actualizarLiga(liga.id, { alias: null });
        updateLiga({ alias: null });
        setAliasMsg({ ok: 'Alias eliminado.', err: '' });
      } else {
        const limpio = await actualizarAlias(liga.id, alias);
        updateLiga({ alias: limpio }); setAlias(limpio);
        setAliasMsg({ ok: 'Link: ' + location.origin + '/?liga=' + limpio, err: '' });
      }
      refresh(); toast('Alias guardado');
    } catch (err) { setAliasMsg({ ok: '', err: err.message }); }
  };

  const renovarCodigo_ = async () => {
    if (!window.confirm('¿Renovar el código? El anterior dejará de funcionar.')) return;
    const nuevo = await renovarCodigo(liga.id);
    updateLiga({ codigo: nuevo }); refresh(); toast('Código renovado');
  };

  const copiarLink = () => {
    const link = location.origin + '/?liga=' + (liga.alias || liga.codigo);
    navigator.clipboard?.writeText(link).then(() => toast('Link copiado')).catch(() => toast(link));
  };

  const invitar = async () => {
    if (!invEmail.trim()) { toast('Escribe un correo', 'error'); return; }
    try {
      await invitarCoAdmin(liga.id, invEmail);
      setInvEmail('');
      setMiembros(await getMiembros(liga.id));
      toast('Co-admin invitado');
    } catch (err) { toast(err.message, 'error'); }
  };

  const quitar = async miembro => {
    if (!window.confirm('¿Quitar este co-admin?')) return;
    await quitarMiembro(liga.id, miembro.user_id);
    setMiembros(prev => prev.filter(x => x.id !== miembro.id));
    toast('Co-admin eliminado');
  };

  return (
    <>
      <h2>⚙ <span>Configuración</span></h2>

      {/* Básico */}
      <div className="card">
        <p className="card-subtitle">Liga</p>
        <form onSubmit={guardarBasico}>
          <div className="form-row">
            <div className="form-group" style={{ flex: 3 }}>
              <label>Nombre</label>
              <input type="text" maxLength={60} required value={cfg.nombre}
                onChange={e => setCfg(c => ({ ...c, nombre: e.target.value }))} />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Temporada</label>
              <input type="text" maxLength={20} value={cfg.temporada}
                onChange={e => setCfg(c => ({ ...c, temporada: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Vueltas</label>
              <select value={cfg.vueltas} onChange={e => setCfg(c => ({ ...c, vueltas: parseInt(e.target.value) }))}>
                <option value={1}>1</option><option value={2}>2</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Precio inscripción ($)</label>
              <input type="number" min={0} style={{ maxWidth: 100 }} value={cfg.precioInscripcion}
                onChange={e => setCfg(c => ({ ...c, precioInscripcion: parseInt(e.target.value) || 500 }))} />
            </div>
            <div className="form-group">
              <label>Precio arbitraje ($)</label>
              <input type="number" min={0} style={{ maxWidth: 100 }} value={cfg.precioArbitraje}
                onChange={e => setCfg(c => ({ ...c, precioArbitraje: parseInt(e.target.value) || 120 }))} />
            </div>
          </div>
          <label className="check-row cfg-toggle-row">
            <input type="checkbox" checked={cfg.permitirAdelantoArb !== false}
              onChange={e => setCfg(c => ({ ...c, permitirAdelantoArb: e.target.checked }))} />
            <span><strong>Permitir adelanto de arbitrajes</strong><small>Muestra el panel por equipo en Finanzas.</small></span>
          </label>
          <label className="check-row cfg-toggle-row">
            <input type="checkbox" checked={cfg.permitirComentarios !== false}
              onChange={e => setCfg(c => ({ ...c, permitirComentarios: e.target.checked }))} />
            <span><strong>Habilitar quejas y sugerencias</strong><small>Permite comentarios desde la vista pública.</small></span>
          </label>
          <div className="flex mt1"><button type="submit" className="btn">Guardar</button></div>
        </form>
      </div>

      {/* Formato */}
      <div className="card">
        <p className="card-subtitle">Formato del partido</p>
        <label className="check-row cfg-toggle-row">
          <input type="checkbox" checked={cfg.usarSets}
            onChange={e => setCfg(c => ({ ...c, usarSets: e.target.checked }))} />
          <span><strong>Registrar sets</strong><small>Desactiva para solo registrar ganador/perdedor.</small></span>
        </label>
        <label className="check-row cfg-toggle-row">
          <input type="checkbox" checked={cfg.usarPuntos}
            onChange={e => setCfg(c => ({ ...c, usarPuntos: e.target.checked }))} />
          <span><strong>Columna de puntos (PTS)</strong></span>
        </label>
        <div className="form-row" style={{ marginTop: '.8rem' }}>
          <div className="form-group">
            <label>Pts victoria</label>
            <input type="number" min={0} style={{ maxWidth: 80 }} value={cfg.ptsVictoria}
              onChange={e => setCfg(c => ({ ...c, ptsVictoria: parseInt(e.target.value) || 2 }))} />
          </div>
          <div className="form-group">
            <label>Bono derrota</label>
            <input type="number" min={0} style={{ maxWidth: 80 }} value={cfg.ptsBono}
              onChange={e => setCfg(c => ({ ...c, ptsBono: parseInt(e.target.value) || 0 }))} />
          </div>
          <div className="form-group">
            <label>Pts derrota</label>
            <input type="number" min={0} style={{ maxWidth: 80 }} value={cfg.ptsDerota}
              onChange={e => setCfg(c => ({ ...c, ptsDerota: parseInt(e.target.value) || 0 }))} />
          </div>
        </div>
        <div className="flex mt1"><button className="btn" onClick={guardarFormato}>Guardar formato</button></div>
      </div>

      {/* Acceso público */}
      {mostrarPagoAddon && <ModalPago soloAddon onCerrar={() => setMostrarPagoAddon(false)} />}
      <div className="card">
        <p className="card-subtitle">Acceso público</p>

        {/* Estado del add-on para plan básico */}
        {plan === 'basico' && (
          <div style={{
            marginBottom: '1rem', padding: '.9rem 1rem',
            borderRadius: 'var(--radius)', border: '1px solid var(--border2)',
            background: puedeVerPublico ? 'rgba(16,185,129,.06)' : 'var(--bg2)',
          }}>
            {puedeVerPublico ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.2rem' }}>🌐</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--green)' }}>
                    Vista pública activa
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.1rem' }}>
                    {currentProfile?.addon_vp_expira
                      ? `Válido hasta ${new Date(currentProfile.addon_vp_expira).toLocaleDateString('es-MX')}`
                      : 'Sin fecha de expiración (pago único)'
                    }
                  </div>
                </div>
                <span className="badge win">✓ Activo</span>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem', marginBottom: '.8rem' }}>
                  <span style={{ fontSize: '1.2rem' }}>🔒</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '.88rem' }}>Vista pública no activa</div>
                    <div style={{ fontSize: '.75rem', color: 'var(--muted)', marginTop: '.1rem' }}>
                      Activa el add-on para que cualquiera vea tu liga con el link.
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                  <button className="btn small" onClick={() => setMostrarPagoAddon(true)}>
                    🌐 Activar vista pública — $100 MXN
                  </button>
                  <button className="btn secondary small" onClick={() => setMostrarPagoAddon(true)}>
                    Ver opciones
                  </button>
                </div>
                <p className="muted" style={{ fontSize: '.72rem', marginTop: '.5rem' }}>
                  $100 MXN pago único (para siempre) · $70 MXN por temporada (6 meses)
                </p>
              </div>
            )}
          </div>
        )}

        {/* Para planes medio y top: vista pública incluida */}
        {plan !== 'basico' && (
          <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
            <span className="badge win">✓ Vista pública incluida en tu plan</span>
          </div>
        )}

        <p className="muted" style={{ fontSize: '.85rem', marginBottom: '1rem' }}>
          Comparte el link para que cualquiera vea tu liga sin iniciar sesión.
        </p>

        {/* Alias — solo plan Top */}
        {puedeAlias ? (
          <div style={{ marginBottom: '1.2rem' }}>
            <label style={{ fontSize: '.82rem', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '.4rem' }}>
              Nombre corto personalizado
            </label>
            <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <input type="text" placeholder="mi-liga-2025" maxLength={20}
                style={{ maxWidth: 200, fontSize: '.95rem' }} value={alias}
                onChange={e => setAlias(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} />
              <button className="btn" onClick={guardarAlias_}>Guardar alias</button>
            </div>
            <p className="muted" style={{ fontSize: '.75rem', marginTop: '.4rem' }}>
              Solo minúsculas, números y guiones. Min 3 caracteres.<br />
              {liga.alias ? 'Link: ' + location.origin + '/?liga=' + liga.alias : 'Sin alias aún.'}
            </p>
            {aliasMsg.err && <div className="auth-error" style={{ marginTop: '.4rem' }}>{aliasMsg.err}</div>}
            {aliasMsg.ok  && <div style={{ color: 'var(--green)', fontSize: '.82rem', marginTop: '.4rem' }}>{aliasMsg.ok}</div>}
          </div>
        ) : (
          <div style={{ marginBottom: '1.2rem', padding: '.75rem', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <p style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
              🔒 El alias personalizado está disponible en el <strong>Plan Top</strong>.
            </p>
          </div>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
          <label style={{ fontSize: '.82rem', color: 'var(--muted)', fontWeight: 600, display: 'block', marginBottom: '.6rem' }}>
            Código de respaldo
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <code className="codigo-chip" style={{ fontSize: '1.3rem', padding: '.4rem 1rem' }}>{liga.codigo}</code>
            <button className="btn secondary" onClick={renovarCodigo_}>Renovar</button>
            <button className="btn secondary" onClick={copiarLink}>Copiar link</button>
          </div>
        </div>
      </div>

      {/* Co-admins — solo si el plan lo permite */}
      <div className="card">
        <p className="card-subtitle">Co-administradores</p>
        {!puedeCoAdmins ? (
          <p style={{ fontSize: '.85rem', color: 'var(--muted)', padding: '.5rem 0' }}>
            🔒 Los co-administradores están disponibles en el <strong>Plan Top</strong>.
          </p>
        ) : (
          <>
            {miembros.map(m => (
              <div key={m.id} className="fixture-item">
                <span style={{ flex: 1 }}>{m.profiles?.nombre || m.profiles?.email || '—'}</span>
                <span className={'badge ' + (m.role === 'owner' ? 'win' : 'pending')}>
                  {m.role === 'owner' ? 'Propietario' : 'Co-admin'}
                </span>
                {m.role !== 'owner' && (
                  <button className="btn danger small" onClick={() => quitar(m)}>Quitar</button>
                )}
              </div>
            ))}
            <div className="form-row" style={{ marginTop: '1rem' }}>
              <input type="email" placeholder="correo@ejemplo.com" style={{ flex: 1 }}
                value={invEmail} onChange={e => setInvEmail(e.target.value)} />
              <button className="btn" onClick={invitar}>Invitar</button>
            </div>
          </>
        )}
      </div>

      {/* Notificaciones */}
      <div className="card">
        <p className="card-subtitle">Notificaciones</p>
        <p className="muted" style={{ fontSize: '.82rem', marginBottom: '.8rem' }}>
          Recibe un aviso cada vez que se registre un partido.
        </p>
        <PushToggle />
      </div>

      {/* Diseño Vista Pública */}
      {puedeDisenoPublico
        ? <TabDisenoPublico liga={liga} refresh={refresh} updateLiga={updateLiga} />
        : (
          <div className="card">
            <p className="card-subtitle">🎨 Diseño de vista pública</p>
            <div style={{ padding: '.5rem 0' }}>
              <p style={{ fontSize: '.85rem', color: 'var(--muted)', marginBottom: '.8rem' }}>
                🔒 Personaliza los colores, logo y fondo de tu vista pública. Disponible en el <strong>Plan Top</strong>.
              </p>
              <div style={{
                borderRadius: 'var(--radius)', border: '1px dashed var(--border2)',
                padding: '1.2rem', display: 'flex', gap: '1rem', alignItems: 'center',
                background: 'var(--bg2)', opacity: .6,
              }}>
                <span style={{ fontSize: '2rem' }}>🎨</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '.88rem' }}>Color, logo, fondo, tipografía</div>
                  <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>Preview en tiempo real antes de publicar</div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Zona de peligro */}
      <div className="card" style={{ borderColor: 'rgba(244,63,94,.25)', marginTop: '1rem' }}>
        <p className="card-subtitle" style={{ color: 'var(--red)' }}>Zona de peligro</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
          {onCrearNueva && (
            <div className="danger-row">
              <div>
                <strong style={{ fontSize: '.9rem' }}>Crear nueva liga</strong>
                <p className="muted" style={{ fontSize: '.78rem', marginTop: '.1rem' }}>
                  Crea otra liga en tu cuenta.
                </p>
              </div>
              <button className="btn secondary small" onClick={onCrearNueva}>+ Nueva liga</button>
            </div>
          )}
          {onEliminar && (
            <div className="danger-row">
              <div>
                <strong style={{ fontSize: '.9rem' }}>Eliminar liga</strong>
                <p className="muted" style={{ fontSize: '.78rem', marginTop: '.1rem' }}>
                  Elimina esta liga y todos sus datos permanentemente.
                </p>
              </div>
              <button className="btn danger small" onClick={onEliminar}>Eliminar liga</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════
//  TAB DISEÑO VISTA PÚBLICA (solo plan Top)
// ════════════════════════════════════════════════════════════

const FUENTES = [
  { value: 'Inter',            label: 'Inter — predeterminada'  },
  { value: 'Oswald',           label: 'Oswald — deportiva'      },
  { value: 'Montserrat',       label: 'Montserrat — moderna'    },
  { value: 'Bebas Neue',       label: 'Bebas Neue — impacto'    },
  { value: 'Roboto Condensed', label: 'Roboto Condensed'        },
  { value: 'Poppins',          label: 'Poppins — redondeada'    },
  { value: 'Raleway',          label: 'Raleway — elegante'      },
];

const DISENO_DEFAULT = {
  // Fondo de página (general — header, tabs y contenido se mezclan con esto)
  paginaFondoUrl:      '',
  paginaFondoColor:    '#080f1e',
  paginaOverlay:       55,          // 0-100 oscuridad del overlay sobre la imagen
  paginaFondoFijo:     true,        // fondo fijo al hacer scroll
  // Header
  headerTransparente:  true,        // si true, se mezcla con el fondo de página
  colorHeaderFondo:    '#080f1e',
  colorHeaderTexto:    '#ffffff',
  logoUrl:             '',
  mostrarLogo:         true,
  mostrarNombre:       true,
  nombrePersonal:      '',
  slogan:              '',
  mostrarCodigo:       true,
  // Tabs
  tabsTransparente:    true,        // si true, se mezcla con el fondo de página
  colorTabFondo:       '#111c2e',
  colorTabActivo:      '#f59e0b',
  colorTabActivoTexto: '#0a0a0a',
  colorTabTexto:       '#94a3b8',
  // Tabla
  colorTablaFondo:     '#111c2e',
  colorTablaEncabezado:'#172236',
  colorTablaTexto:     '#eef2ff',
  colorTablaTextoMuted:'#64748b',
  tablaTransparencia:  0,           // 0 = tarjeta sólida, 100 = se ve el fondo de página
  colorPrimario:       '#f59e0b',   // badges, wins, pts
  colorVictoria:       '#10b981',
  colorDerrota:        '#f43f5e',
  // Tipografía
  fuente:              'Inter',
};

function ColorPicker({ label, hint, value, onChange }) {
  return (
    <div>
      <label style={{ fontSize: '.75rem', color: 'var(--muted2)', fontWeight: 600, display: 'block', marginBottom: '.25rem' }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          style={{ width: 36, height: 32, borderRadius: 7, border: '1px solid var(--border2)', cursor: 'pointer', padding: 2, background: 'var(--bg2)', flexShrink: 0 }} />
        <input type="text" value={value} maxLength={7} onChange={e => onChange(e.target.value)}
          style={{ width: 82, fontFamily: 'monospace', fontSize: '.8rem', padding: '.25rem .4rem', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)' }} />
      </div>
      {hint && <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginTop: '.15rem' }}>{hint}</div>}
    </div>
  );
}

function SliderPicker({ label, hint, value, onChange, min = 0, max = 100, suffix = '%' }) {
  return (
    <div>
      <label style={{ fontSize: '.75rem', color: 'var(--muted2)', fontWeight: 600, display: 'block', marginBottom: '.25rem' }}>
        {label} <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{value}{suffix}</span>
      </label>
      <input type="range" min={min} max={max} value={value} onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent)' }} />
      {hint && <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginTop: '.1rem' }}>{hint}</div>}
    </div>
  );
}

function SeccionDiseno({ titulo, children }) {
  return (
    <div style={{ marginBottom: '1.2rem' }}>
      <div style={{ fontSize: '.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--accent)', marginBottom: '.7rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        {titulo}
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      {children}
    </div>
  );
}

function TabDisenoPublico({ liga, refresh, updateLiga }) {
  const disenoInicial = liga.config?.diseno || {};
  const [d, setD] = useState({ ...DISENO_DEFAULT, nombrePersonal: liga.nombre || '', ...disenoInicial });
  const [logoPreview,   setLogoPreview]   = useState(disenoInicial.logoUrl       || '');
  const [paginaPreview, setPaginaPreview] = useState(disenoInicial.paginaFondoUrl || '');
  const [guardando,    setGuardando]    = useState(false);
  const [tab,          setTab]          = useState('fondo');

  const set = (key, val) => setD(prev => ({ ...prev, [key]: val }));

  const handleArchivo = (e, tipo) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const data = ev.target.result;
      if (tipo === 'logo') { setLogoPreview(data); set('logoUrl', data); }
      else                 { setPaginaPreview(data); set('paginaFondoUrl', data); }
    };
    reader.readAsDataURL(file);
  };

  const guardar = async () => {
    setGuardando(true);
    try {
      const nuevoCfg = { ...(liga.config || {}), diseno: d };
      await actualizarLiga(liga.id, { config: nuevoCfg });
      updateLiga({ config: nuevoCfg });
      toast('Diseño guardado ✓');
    } catch (err) { toast(err.message, 'error'); }
    finally { setGuardando(false); }
  };

  const resetDiseno = async () => {
    if (!window.confirm('¿Restablecer el diseño predeterminado?')) return;
    const nuevo = { ...DISENO_DEFAULT, nombrePersonal: liga.nombre || '' };
    const nuevoCfg = { ...(liga.config || {}), diseno: nuevo };
    await actualizarLiga(liga.id, { config: nuevoCfg });
    updateLiga({ config: nuevoCfg });
    setD(nuevo); setLogoPreview(''); setPaginaPreview('');
    toast('Diseño restablecido');
  };

  const SUBTABS = [
    { id: 'fondo',     label: '🖼 Fondo'    },
    { id: 'header',    label: '🏷 Header'   },
    { id: 'tabs',      label: '📑 Tabs'     },
    { id: 'tabla',     label: '📊 Tabla'    },
    { id: 'tipografia',label: '🔤 Fuente'   },
    { id: 'preview',   label: '👁 Preview'  },
  ];

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <p className="card-subtitle" style={{ margin: 0 }}>🎨 Diseño de vista pública</p>
        <div style={{ display: 'flex', gap: '.4rem' }}>
          <button className="btn secondary small" style={{ color: 'var(--muted)', fontSize: '.75rem' }} onClick={resetDiseno}>
            Restablecer
          </button>
          <button className="btn small" onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : '💾 Guardar'}
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: '.2rem', marginBottom: '1.2rem', background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: '.25rem', border: '1px solid var(--border)', overflowX: 'auto' }}>
        {SUBTABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: '.38rem .5rem', borderRadius: 6, border: 'none',
            fontWeight: 600, cursor: 'pointer', fontSize: '.77rem', whiteSpace: 'nowrap',
            background: tab === t.id ? 'var(--accent)' : 'transparent',
            color: tab === t.id ? '#0a0a0a' : 'var(--muted2)',
            transition: 'all .15s',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── FONDO DE PÁGINA ── */}
      {tab === 'fondo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <div style={{
            borderRadius: 'var(--radius)', border: '1px dashed var(--border2)',
            padding: '.9rem 1rem', background: 'var(--accent-soft)', display: 'flex', gap: '.7rem', alignItems: 'flex-start',
          }}>
            <span style={{ fontSize: '1.4rem' }}>💡</span>
            <p style={{ fontSize: '.8rem', color: 'var(--muted2)', margin: 0, lineHeight: 1.5 }}>
              Esta es la base de un diseño profesional: una sola imagen o color de fondo para <strong>toda la página</strong>.
              El header, las pestañas y la tabla pueden ser transparentes para que todo se vea como una sola pieza,
              igual que las tablas que tus clientes ya diseñan para sus redes sociales.
            </p>
          </div>

          <SeccionDiseno titulo="IMAGEN DE FONDO (TODA LA PÁGINA)">
            {paginaPreview && (
              <div style={{ marginBottom: '.7rem', position: 'relative', display: 'inline-block' }}>
                <img src={paginaPreview} alt="fondo" style={{ height: 90, width: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border2)' }} />
                <button className="btn danger small" style={{ position: 'absolute', top: -6, right: -6, padding: '.1rem .35rem', fontSize: '.7rem' }}
                  onClick={() => { setPaginaPreview(''); set('paginaFondoUrl', ''); }}>✕</button>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', marginBottom: '1rem' }}>
              <input type="file" accept="image/*" onChange={e => handleArchivo(e, 'pagina')} style={{ fontSize: '.78rem', color: 'var(--text2)' }} />
              <input type="url" placeholder="https://... (URL de imagen)" value={d.paginaFondoUrl?.startsWith('data:') ? '' : (d.paginaFondoUrl || '')}
                onChange={e => { set('paginaFondoUrl', e.target.value); setPaginaPreview(e.target.value); }}
                style={{ fontSize: '.82rem' }} />
              <div style={{ fontSize: '.65rem', color: 'var(--muted)' }}>
                Recomendado: foto horizontal de buena calidad (mínimo 1200px de ancho).
              </div>
            </div>

            {(paginaPreview || d.paginaFondoUrl) && (
              <>
                <SliderPicker label="Oscuridad del overlay" hint="Capa oscura sobre la imagen para que el texto se lea bien"
                  value={d.paginaOverlay} onChange={v => set('paginaOverlay', v)} />
                <label className="check-row" style={{ marginTop: '.6rem' }}>
                  <input type="checkbox" checked={d.paginaFondoFijo !== false} onChange={e => set('paginaFondoFijo', e.target.checked)}
                    style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                  <span><strong style={{ fontSize: '.85rem' }}>Fondo fijo</strong> <small style={{ color: 'var(--muted)' }}>(no se mueve al hacer scroll)</small></span>
                </label>
              </>
            )}
          </SeccionDiseno>

          <SeccionDiseno titulo="COLOR DE FONDO">
            <ColorPicker label="Color base" hint="Se usa si no hay imagen, y detrás del overlay" value={d.paginaFondoColor} onChange={v => set('paginaFondoColor', v)} />
          </SeccionDiseno>
        </div>
      )}

      {/* ── HEADER ── */}
      {tab === 'header' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
          <SeccionDiseno titulo="FONDO DEL HEADER">
            <label className="check-row" style={{ marginBottom: '.8rem' }}>
              <input type="checkbox" checked={d.headerTransparente !== false} onChange={e => set('headerTransparente', e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '.1rem' }}>
                <strong style={{ fontSize: '.85rem' }}>Header transparente</strong>
                <small style={{ color: 'var(--muted)', fontSize: '.72rem' }}>Se mezcla con el fondo de página (recomendado)</small>
              </span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}>
              {d.headerTransparente === false && (
                <ColorPicker label="Color de fondo propio" value={d.colorHeaderFondo} onChange={v => set('colorHeaderFondo', v)} />
              )}
              <ColorPicker label="Color de texto" value={d.colorHeaderTexto} onChange={v => set('colorHeaderTexto', v)} />
            </div>
          </SeccionDiseno>

          <SeccionDiseno titulo="LOGO">
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div>
                {logoPreview
                  ? <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img src={logoPreview} alt="logo" style={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border2)', background: d.headerTransparente !== false ? d.paginaFondoColor : d.colorHeaderFondo, padding: 4 }} />
                      <button className="btn danger small" style={{ position: 'absolute', top: -6, right: -6, padding: '.1rem .35rem', fontSize: '.7rem' }}
                        onClick={() => { setLogoPreview(''); set('logoUrl', ''); }}>✕</button>
                    </div>
                  : <div style={{ width: 64, height: 64, borderRadius: 10, border: '1px dashed var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem' }}>🏐</div>
                }
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                <input type="file" accept="image/*" onChange={e => handleArchivo(e, 'logo')} style={{ fontSize: '.78rem', color: 'var(--text2)' }} />
                <input type="url" placeholder="https://... (URL del logo)" value={d.logoUrl?.startsWith('data:') ? '' : (d.logoUrl || '')}
                  onChange={e => { set('logoUrl', e.target.value); setLogoPreview(e.target.value); }}
                  style={{ fontSize: '.82rem' }} />
              </div>
            </div>
            <label className="check-row" style={{ marginTop: '.7rem' }}>
              <input type="checkbox" checked={d.mostrarLogo !== false} onChange={e => set('mostrarLogo', e.target.checked)} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
              <span><strong style={{ fontSize: '.85rem' }}>Mostrar logo</strong></span>
            </label>
          </SeccionDiseno>

          <SeccionDiseno titulo="NOMBRE Y SLOGAN">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
              <div>
                <label style={{ fontSize: '.75rem', color: 'var(--muted2)', fontWeight: 600, display: 'block', marginBottom: '.25rem' }}>Nombre a mostrar</label>
                <input type="text" maxLength={60} value={d.nombrePersonal} placeholder={liga.nombre}
                  onChange={e => set('nombrePersonal', e.target.value)} />
                <div style={{ fontSize: '.65rem', color: 'var(--muted)', marginTop: '.15rem' }}>Deja vacío para usar el nombre oficial</div>
              </div>
              <div>
                <label style={{ fontSize: '.75rem', color: 'var(--muted2)', fontWeight: 600, display: 'block', marginBottom: '.25rem' }}>Slogan / subtítulo (opcional)</label>
                <input type="text" maxLength={80} value={d.slogan || ''} placeholder="Temporada 2025 · Liga amateur"
                  onChange={e => set('slogan', e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                <label className="check-row">
                  <input type="checkbox" checked={d.mostrarNombre !== false} onChange={e => set('mostrarNombre', e.target.checked)} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                  <span><strong style={{ fontSize: '.85rem' }}>Mostrar nombre</strong></span>
                </label>
                <label className="check-row">
                  <input type="checkbox" checked={d.mostrarCodigo !== false} onChange={e => set('mostrarCodigo', e.target.checked)} style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
                  <span><strong style={{ fontSize: '.85rem' }}>Mostrar código</strong></span>
                </label>
              </div>
            </div>
          </SeccionDiseno>
        </div>
      )}

      {/* ── TABS ── */}
      {tab === 'tabs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SeccionDiseno titulo="BARRA DE NAVEGACIÓN">
            <label className="check-row" style={{ marginBottom: '.8rem' }}>
              <input type="checkbox" checked={d.tabsTransparente !== false} onChange={e => set('tabsTransparente', e.target.checked)}
                style={{ accentColor: 'var(--accent)', width: 15, height: 15 }} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: '.1rem' }}>
                <strong style={{ fontSize: '.85rem' }}>Barra transparente</strong>
                <small style={{ color: 'var(--muted)', fontSize: '.72rem' }}>Se mezcla con el fondo de página (recomendado)</small>
              </span>
            </label>
            <p className="muted" style={{ fontSize: '.72rem', marginBottom: '.8rem' }}>
              Las pestañas siempre se muestran centradas.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem' }}>
              {d.tabsTransparente === false && (
                <ColorPicker label="Fondo de la barra" value={d.colorTabFondo} onChange={v => set('colorTabFondo', v)} />
              )}
              <ColorPicker label="Texto inactivo" value={d.colorTabTexto} onChange={v => set('colorTabTexto', v)} />
              <ColorPicker label="Color tab activo" value={d.colorTabActivo} onChange={v => set('colorTabActivo', v)} />
              <ColorPicker label="Texto tab activo" value={d.colorTabActivoTexto} onChange={v => set('colorTabActivoTexto', v)} />
            </div>
          </SeccionDiseno>
        </div>
      )}

      {/* ── TABLA ── */}
      {tab === 'tabla' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <SeccionDiseno titulo="TARJETA DE LA TABLA">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.8rem', marginBottom: '.8rem' }}>
              <ColorPicker label="Fondo de la tabla" hint="Filas del cuerpo" value={d.colorTablaFondo} onChange={v => set('colorTablaFondo', v)} />
              <ColorPicker label="Fondo de encabezados" hint="Fila de títulos (PJ, PG, etc.)" value={d.colorTablaEncabezado} onChange={v => set('colorTablaEncabezado', v)} />
              <ColorPicker label="Color de texto" value={d.colorTablaTexto} onChange={v => set('colorTablaTexto', v)} />
              <ColorPicker label="Texto secundario" hint="PJ, números menores" value={d.colorTablaTextoMuted} onChange={v => set('colorTablaTextoMuted', v)} />
            </div>
            <SliderPicker label="Transparencia (efecto vidrio)" hint="0% = tarjeta sólida · valores altos dejan ver el fondo de página detrás de la tabla, como una tarjeta de cristal"
              value={d.tablaTransparencia} onChange={v => set('tablaTransparencia', v)} />
          </SeccionDiseno>
          <SeccionDiseno titulo="COLORES DE RESULTADOS">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.8rem' }}>
              <ColorPicker label="Color primario" hint="Pts, destacados" value={d.colorPrimario} onChange={v => set('colorPrimario', v)} />
              <ColorPicker label="Victorias (PG)" value={d.colorVictoria} onChange={v => set('colorVictoria', v)} />
              <ColorPicker label="Derrotas (PP)" value={d.colorDerrota} onChange={v => set('colorDerrota', v)} />
            </div>
          </SeccionDiseno>
        </div>
      )}

      {/* ── TIPOGRAFÍA ── */}
      {tab === 'tipografia' && (
        <SeccionDiseno titulo="FUENTE">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
            {FUENTES.map(f => (
              <label key={f.value} style={{
                display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
                padding: '.7rem 1rem', borderRadius: 'var(--radius)',
                border: `2px solid ${d.fuente === f.value ? 'var(--accent)' : 'var(--border2)'}`,
                background: d.fuente === f.value ? 'var(--accent-soft)' : 'var(--bg2)',
                transition: 'all .15s',
              }}>
                <input type="radio" name="fuente" value={f.value} checked={d.fuente === f.value}
                  onChange={() => set('fuente', f.value)} style={{ accentColor: 'var(--accent)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: `'${f.value}', sans-serif`, fontWeight: 700, fontSize: '1rem' }}>
                    {f.label.split('—')[0].trim()}
                  </div>
                  <div style={{ fontSize: '.72rem', color: 'var(--muted)' }}>
                    {f.label.split('—')[1]?.trim()}
                  </div>
                </div>
                <div style={{ fontFamily: `'${f.value}', sans-serif`, fontSize: '.82rem', color: 'var(--muted2)' }}>
                  Abc 123
                </div>
              </label>
            ))}
          </div>
        </SeccionDiseno>
      )}

      {/* ── PREVIEW ── */}
      {tab === 'preview' && (
        <div>
          <p className="muted" style={{ fontSize: '.78rem', marginBottom: '1rem' }}>
            Preview en tiempo real — refleja exactamente cómo se verá la vista pública.
          </p>
          <PreviewVistaPublica liga={liga} d={d} logoPreview={logoPreview} paginaPreview={paginaPreview} />
        </div>
      )}
    </div>
  );
}

// ── Preview completo de la vista pública ──────────────────────
function PreviewVistaPublica({ liga, d, logoPreview, paginaPreview }) {
  const fondoPagina = paginaPreview || d.paginaFondoUrl || '';
  const logo        = logoPreview   || d.logoUrl        || '';
  const nombre      = d.nombrePersonal?.trim() || liga.nombre;
  const overlay     = (d.paginaOverlay ?? 55) / 100;

  const headerTrans = d.headerTransparente !== false;
  const tabsTrans   = d.tabsTransparente   !== false;

  const transp = d.tablaTransparencia ?? 0;
  const alpha  = Math.round((100 - transp) * 2.55).toString(16).padStart(2, '0');
  const tablaFondo = d.colorTablaFondo + alpha;
  const encabFondo = d.colorTablaEncabezado + alpha;
  const usaBlur = transp > 0 && transp < 100;

  return (
    <div style={{
      borderRadius: 'var(--radius-lg)', border: '1px solid var(--border2)',
      overflow: 'hidden', maxWidth: 500, margin: '0 auto',
      fontFamily: d.fuente !== 'Inter' ? `'${d.fuente}', sans-serif` : 'inherit',
      boxShadow: '0 8px 32px rgba(0,0,0,.4)',
      position: 'relative',
      background: fondoPagina ? `url(${fondoPagina}) center/cover no-repeat` : d.paginaFondoColor,
    }}>
      {fondoPagina && (
        <div style={{ position: 'absolute', inset: 0, background: `rgba(0,0,0,${overlay})` }} />
      )}

      <div style={{ position: 'relative' }}>
        {/* Header */}
        <div style={{
          background: headerTrans ? 'transparent' : d.colorHeaderFondo,
          padding: '1.4rem 1.2rem 1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.9rem', justifyContent: 'center', textAlign: 'left' }}>
            {d.mostrarLogo !== false && (
              logo
                ? <img src={logo} alt="logo" style={{ width: 52, height: 52, objectFit: 'contain', borderRadius: 10, background: 'rgba(255,255,255,.08)', padding: 4, flexShrink: 0 }} />
                : <div style={{ width: 52, height: 52, borderRadius: 10, background: 'rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', flexShrink: 0 }}>🏐</div>
            )}
            <div>
              {d.mostrarNombre !== false && (
                <div style={{ fontWeight: 900, fontSize: '1.15rem', color: d.colorHeaderTexto, letterSpacing: '-.02em', lineHeight: 1.2 }}>
                  {nombre}
                </div>
              )}
              {d.slogan && (
                <div style={{ fontSize: '.78rem', color: d.colorHeaderTexto + 'bb', marginTop: '.15rem' }}>{d.slogan}</div>
              )}
              {d.mostrarCodigo !== false && (
                <code style={{ fontSize: '.7rem', color: d.colorPrimario, fontFamily: 'monospace', letterSpacing: '.06em', marginTop: '.2rem', display: 'block' }}>
                  {liga.alias || liga.codigo}
                </code>
              )}
            </div>
          </div>
        </div>

        {/* Tabs — centradas */}
        <div style={{
          background: tabsTrans ? 'transparent' : d.colorTabFondo,
          display: 'flex', gap: '.2rem', padding: '.5rem .6rem', justifyContent: 'center',
        }}>
          {['Tabla', 'Resultados', 'Programación', '🏆 Playoffs'].map((t, i) => (
            <div key={t} style={{
              padding: '.32rem .75rem', borderRadius: 7, fontSize: '.76rem', fontWeight: 700,
              background: i === 0 ? d.colorTabActivo : 'transparent',
              color: i === 0 ? d.colorTabActivoTexto : d.colorTabTexto,
              whiteSpace: 'nowrap', flexShrink: 0,
            }}>{t}</div>
          ))}
        </div>

        {/* Contenido — tabla con efecto glass */}
        <div style={{ padding: '.9rem 1rem 1.2rem' }}>
          <div style={{
            borderRadius: 10, overflow: 'hidden',
            background: tablaFondo,
            backdropFilter: usaBlur ? 'blur(10px)' : undefined,
            WebkitBackdropFilter: usaBlur ? 'blur(10px)' : undefined,
            boxShadow: transp < 100 ? '0 8px 24px rgba(0,0,0,.3)' : undefined,
          }}>
            {/* Encabezados */}
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 40px 40px 40px 50px', background: encabFondo }}>
              {['#','Equipo','PJ','PG','PP','PTS'].map(h => (
                <div key={h} style={{ padding: '.45rem .5rem', fontSize: '.65rem', fontWeight: 800, color: d.colorTablaTextoMuted, textTransform: 'uppercase', letterSpacing: '.07em', textAlign: h !== 'Equipo' ? 'center' : 'left' }}>
                  {h}
                </div>
              ))}
            </div>
            {/* Filas de ejemplo */}
            {[
              { pos: '🥇', nom: 'Cuervos',   pj: 6, pg: 5, pp: 1, pts: 10 },
              { pos: '🥈', nom: 'Lagos',     pj: 6, pg: 4, pp: 2, pts: 8  },
              { pos: '🥉', nom: 'Halcones',  pj: 6, pg: 3, pp: 3, pts: 6  },
              { pos: '4',  nom: 'Panteras',  pj: 6, pg: 2, pp: 4, pts: 4  },
            ].map((r, i) => (
              <div key={r.nom} style={{
                display: 'grid', gridTemplateColumns: '28px 1fr 40px 40px 40px 50px',
                background: i === 0 ? `${d.colorPrimario}18` : 'transparent',
                borderTop: `1px solid ${d.colorPrimario}11`,
              }}>
                <div style={{ padding: '.42rem .3rem', fontSize: '.78rem', textAlign: 'center', color: d.colorTablaTexto }}>{r.pos}</div>
                <div style={{ padding: '.42rem .5rem', fontSize: '.82rem', fontWeight: 600, color: d.colorTablaTexto }}>{r.nom}</div>
                <div style={{ padding: '.42rem .3rem', fontSize: '.8rem', color: d.colorTablaTextoMuted, textAlign: 'center' }}>{r.pj}</div>
                <div style={{ padding: '.42rem .3rem', fontSize: '.8rem', color: d.colorVictoria, textAlign: 'center', fontWeight: 700 }}>{r.pg}</div>
                <div style={{ padding: '.42rem .3rem', fontSize: '.8rem', color: d.colorDerrota, textAlign: 'center', fontWeight: 700 }}>{r.pp}</div>
                <div style={{ padding: '.42rem .3rem', fontSize: '.88rem', color: d.colorPrimario, textAlign: 'center', fontWeight: 900 }}>{r.pts}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  HELPERS INTERNOS
// ════════════════════════════════════════════════════════════
function generarFixture(noms) {
  const enc = [];
  for (let i = 0; i < noms.length; i++)
    for (let j = i + 1; j < noms.length; j++)
      enc.push({ local: noms[i], visitante: noms[j] });
  return enc;
}

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

function leerSets(sets, reglas) {
  const result = []; let sA = 0, sB = 0;
  const setsParaGanar = Math.ceil(reglas.length / 2);
  for (let i = 0; i < reglas.length; i++) {
    if (sA >= setsParaGanar || sB >= setsParaGanar) break;
    const pA = parseInt(sets[i]?.a), pB = parseInt(sets[i]?.b);
    if (isNaN(pA) || isNaN(pB)) return { ok: false, msg: 'Completa el set ' + (i + 1) };
    const r = reglas[i] || reglas[reglas.length - 1];
    if (r.usarPuntosSet !== false) {
      const max = Math.max(pA, pB), min = Math.min(pA, pB);
      if (max < r.puntos || (max - min) < r.diferencia)
        return { ok: false, msg: 'Set ' + (i + 1) + ' inválido: ' + pA + '-' + pB };
    } else {
      if (pA === pB) return { ok: false, msg: 'Set ' + (i + 1) + ': debe haber un ganador' };
    }
    result.push({ pA, pB });
    if (pA > pB) sA++; else sB++;
  }
  const ganador = sA >= setsParaGanar ? 'A' : sB >= setsParaGanar ? 'B' : null;
  if (!ganador) return { ok: false, msg: 'No hay ganador aún. Completa más sets.' };
  return { ok: true, sets: result, sA, sB, ganador };
}
