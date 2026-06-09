// src/components/ModalPago.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { PLANES } from '../lib/planes.js';

// Configuración de planes para mostrar en el modal
// planKey: qué plan se activa | tipo: mensual | temporada
const OPCIONES_PAGO = [
  {
    key: 'medio_mensual',
    planKey: 'medio',
    tipo: 'mensual',
    label: 'Medio — 1 mes',
    precio: `$${PLANES.medio.precios.mensual} MXN`,
    desc: 'Renovación manual cada mes',
    emoji: '⚡',
  },
  {
    key: 'medio_temporada',
    planKey: 'medio',
    tipo: 'temporada',
    label: 'Medio — 6 meses',
    precio: `$${PLANES.medio.precios.temporada} MXN`,
    desc: `Ahorra $${PLANES.medio.precios.mensual * 6 - PLANES.medio.precios.temporada} MXN vs mensual`,
    emoji: '⚡',
  },
  {
    key: 'top_mensual',
    planKey: 'top',
    tipo: 'mensual',
    label: 'Top — 1 mes',
    precio: `$${PLANES.top.precios.mensual} MXN`,
    desc: 'Acceso completo, renovación manual',
    emoji: '🏆',
    destacado: true,
  },
  {
    key: 'top_temporada',
    planKey: 'top',
    tipo: 'temporada',
    label: 'Top — 6 meses',
    precio: `$${PLANES.top.precios.temporada} MXN`,
    desc: `Ahorra $${PLANES.top.precios.mensual * 6 - PLANES.top.precios.temporada} MXN vs mensual`,
    emoji: '🏆',
  },
];

// Add-ons para plan básico (vista pública)
const ADDONS = [
  {
    key: 'addon_vp_unico',
    label: 'Vista Pública — Para siempre',
    precio: `$${PLANES.basico.addonVistaPublica.unico} MXN`,
    desc: 'Pago único, nunca expira',
    emoji: '🌐',
  },
  {
    key: 'addon_vp_temporada',
    label: 'Vista Pública — 1 temporada',
    precio: `$${PLANES.basico.addonVistaPublica.temporada} MXN`,
    desc: 'Válido por 6 meses desde el pago',
    emoji: '🌐',
  },
];

// Comparativa de features por plan
const FEATURES = [
  { label: 'Ligas activas',        basico: '1',   medio: '2',  top: '3'  },
  { label: 'Equipos por liga',     basico: 'Hasta 8', medio: '∞', top: '∞' },
  { label: 'Vista pública',        basico: 'Add-on', medio: '✅', top: '✅' },
  { label: 'Playoffs',             basico: '❌',  medio: '✅', top: '✅' },
  { label: 'Finanzas',             basico: '❌',  medio: '✅', top: '✅' },
  { label: 'Co-admins',            basico: '❌',  medio: '❌', top: '✅' },
  { label: 'Alias personalizado',  basico: '❌',  medio: '❌', top: '✅' },
  { label: 'Diseño vista pública', basico: '❌',  medio: '❌', top: '✅' },
  { label: 'Comentarios',          basico: '❌',  medio: '❌', top: '✅' },
];

export default function ModalPago({ onCerrar, soloAddon = false }) {
  const { currentUser, currentProfile } = useAuth();
  const [seleccion, setSeleccion] = useState('top_mensual');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const [verComparativa, setVerComparativa] = useState(false);

  const opcionActual = soloAddon
    ? ADDONS.find(a => a.key === seleccion) || ADDONS[0]
    : OPCIONES_PAGO.find(o => o.key === seleccion) || OPCIONES_PAGO[2];

  const iniciarPago = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/crear-preferencia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          email:  currentProfile?.email || currentUser.email,
          opcion: seleccion,   // ej: "medio_mensual", "top_temporada", "addon_vp_unico"
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear el pago');

      window.location.href = data.sandbox_url || data.init_point;
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.8)',
      backdropFilter: 'blur(8px)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      overflowY: 'auto',
    }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-xl)', padding: '2rem', width: '100%',
        maxWidth: verComparativa ? 680 : 460,
        boxShadow: 'var(--shadow-lg)', position: 'relative',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        {/* Línea decorativa top */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, transparent, var(--accent), transparent)',
          borderRadius: 'var(--radius-xl) var(--radius-xl) 0 0',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900 }}>
              {soloAddon ? '🌐 Vista Pública' : '🚀 Mejorar plan'}
            </h2>
            <p className="muted" style={{ fontSize: '.82rem', marginTop: '.25rem' }}>
              {soloAddon
                ? 'Activa la vista pública para tu liga'
                : 'Desbloquea más ligas y funciones'
              }
            </p>
          </div>
          <button className="btn secondary small" onClick={onCerrar}>✕</button>
        </div>

        {/* Toggle comparativa */}
        {!soloAddon && (
          <button
            className="btn secondary small"
            style={{ width: '100%', marginBottom: '1.2rem', fontSize: '.8rem' }}
            onClick={() => setVerComparativa(v => !v)}
          >
            {verComparativa ? '▲ Ocultar comparativa' : '▼ Ver comparativa de planes'}
          </button>
        )}

        {/* Tabla comparativa */}
        {verComparativa && !soloAddon && (
          <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '.83rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '.4rem .6rem', color: 'var(--muted)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>Feature</th>
                  <th style={{ textAlign: 'center', padding: '.4rem .6rem', color: 'var(--muted)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>Básico</th>
                  <th style={{ textAlign: 'center', padding: '.4rem .6rem', color: 'var(--accent)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>⚡ Medio</th>
                  <th style={{ textAlign: 'center', padding: '.4rem .6rem', color: 'var(--accent)', fontWeight: 700, borderBottom: '1px solid var(--border)' }}>🏆 Top</th>
                </tr>
              </thead>
              <tbody>
                {FEATURES.map((f, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent' }}>
                    <td style={{ padding: '.4rem .6rem', color: 'var(--text2)' }}>{f.label}</td>
                    <td style={{ padding: '.4rem .6rem', textAlign: 'center', color: 'var(--muted)' }}>{f.basico}</td>
                    <td style={{ padding: '.4rem .6rem', textAlign: 'center' }}>{f.medio}</td>
                    <td style={{ padding: '.4rem .6rem', textAlign: 'center' }}>{f.top}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ padding: '.5rem .6rem', fontWeight: 700 }}>Precio/mes</td>
                  <td style={{ padding: '.5rem .6rem', textAlign: 'center', color: 'var(--green)', fontWeight: 700 }}>Gratis</td>
                  <td style={{ padding: '.5rem .6rem', textAlign: 'center', color: 'var(--accent)', fontWeight: 700 }}>$99</td>
                  <td style={{ padding: '.5rem .6rem', textAlign: 'center', color: 'var(--accent)', fontWeight: 700 }}>$149</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Opciones de pago */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', marginBottom: '1.5rem' }}>
          {(soloAddon ? ADDONS : OPCIONES_PAGO).map(opcion => (
            <label key={opcion.key} style={{
              display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
              padding: '.85rem 1rem', borderRadius: 'var(--radius)',
              border: `2px solid ${seleccion === opcion.key ? 'var(--accent)' : 'var(--border2)'}`,
              background: seleccion === opcion.key ? 'var(--accent-soft)' : 'var(--card2)',
              transition: 'all .15s',
              position: 'relative',
            }}>
              {opcion.destacado && (
                <span style={{
                  position: 'absolute', top: -8, right: 12,
                  background: 'var(--accent)', color: '#0a0a0a',
                  fontSize: '.65rem', fontWeight: 800, padding: '.15rem .5rem',
                  borderRadius: 99, letterSpacing: '.03em',
                }}>
                  RECOMENDADO
                </span>
              )}
              <input
                type="radio"
                name="plan"
                value={opcion.key}
                checked={seleccion === opcion.key}
                onChange={() => setSeleccion(opcion.key)}
                style={{ accentColor: 'var(--accent)', flexShrink: 0 }}
              />
              <span style={{ fontSize: '1.3rem' }}>{opcion.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{opcion.label}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--muted)' }}>{opcion.desc}</div>
              </div>
              <div style={{ fontWeight: 900, color: 'var(--accent)', fontSize: '1rem', whiteSpace: 'nowrap' }}>
                {opcion.precio}
              </div>
            </label>
          ))}
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>
        )}

        <button
          className="btn"
          style={{ width: '100%', padding: '.85rem', fontSize: '1rem', fontWeight: 800 }}
          onClick={iniciarPago}
          disabled={loading}
        >
          {loading
            ? 'Redirigiendo a MercadoPago…'
            : `Pagar ${(soloAddon ? ADDONS : OPCIONES_PAGO).find(o => o.key === seleccion)?.precio} con MercadoPago`
          }
        </button>

        <p className="muted" style={{ fontSize: '.72rem', textAlign: 'center', marginTop: '.75rem' }}>
          Pago seguro procesado por MercadoPago. Sin renovación automática.
        </p>
      </div>
    </div>
  );
}
