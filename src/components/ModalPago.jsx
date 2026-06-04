// src/components/ModalPago.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

export default function ModalPago({ onCerrar }) {
  const { currentUser, currentProfile } = useAuth();
  const [plan,     setPlan]     = useState('mensual');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  const precios = {
    mensual:   { precio: '$100 MXN', label: '1 mes',          desc: 'Renovación manual' },
    temporada: { precio: '$750 MXN', label: '6 meses',        desc: 'Ahorra $150 MXN' },
  };

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
          plan,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear pago');

      // En sandbox usar sandbox_url, en producción usar init_point
      const { sandbox_url } = await res.json();
      window.location.href = sandbox_url; // ← sandbox, no init_point

    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.75)',
      backdropFilter: 'blur(6px)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        background: 'var(--card)', border: '1px solid var(--border2)',
        borderRadius: 'var(--radius-xl)', padding: '2rem', width: '100%', maxWidth: 420,
        boxShadow: 'var(--shadow-lg)', position: 'relative'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 900 }}>
              🚀 Plan <span style={{ color: 'var(--accent)' }}>Pro</span>
            </h2>
            <p className="muted" style={{ fontSize: '.82rem', marginTop: '.2rem' }}>
              Desbloquea todas las funciones
            </p>
          </div>
          <button className="btn secondary small" onClick={onCerrar}>✕</button>
        </div>

        {/* Selector de plan */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', marginBottom: '1.5rem' }}>
          {Object.entries(precios).map(([key, val]) => (
            <label key={key} style={{
              display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer',
              padding: '.9rem 1rem', borderRadius: 'var(--radius)',
              border: `2px solid ${plan === key ? 'var(--accent)' : 'var(--border2)'}`,
              background: plan === key ? 'var(--accent-soft)' : 'var(--card2)',
              transition: 'all .15s',
            }}>
              <input type="radio" name="plan" value={key}
                checked={plan === key} onChange={() => setPlan(key)}
                style={{ accentColor: 'var(--accent)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{val.label}</div>
                <div style={{ fontSize: '.78rem', color: 'var(--muted)' }}>{val.desc}</div>
              </div>
              <div style={{ fontWeight: 900, color: 'var(--accent)', fontSize: '1.1rem' }}>
                {val.precio}
              </div>
            </label>
          ))}
        </div>

        {/* Features */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <p className="card-subtitle">Incluye</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.4rem', fontSize: '.88rem' }}>
            <span>✅ Ligas ilimitadas</span>
            <span>✅ Equipos ilimitados</span>
            <span>✅ Bracket de playoffs</span>
            <span>✅ Módulo de finanzas</span>
            <span>✅ Alias personalizado</span>
            <span>✅ Co-administradores</span>
          </div>
        </div>

        {error && (
          <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>
        )}

        <button
          className="btn"
          style={{ width: '100%', padding: '.8rem', fontSize: '1rem' }}
          onClick={iniciarPago}
          disabled={loading}
        >
          {loading ? 'Redirigiendo a MercadoPago…' : `Pagar ${precios[plan].precio} con MercadoPago`}
        </button>

        <p className="muted" style={{ fontSize: '.72rem', textAlign: 'center', marginTop: '.8rem' }}>
          Pago seguro procesado por MercadoPago
        </p>
      </div>
    </div>
  );
}
