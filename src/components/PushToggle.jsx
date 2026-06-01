// ============================================================
//  PushToggle.jsx — Botón de notificaciones push (React)
// ============================================================
import { useState } from 'react';
import { isPushSupported, getPermissionStatus, requestPermission } from '../lib/push.js';

export default function PushToggle() {
  const [status, setStatus] = useState(() => getPermissionStatus());

  if (!isPushSupported()) return null;

  const activar = async () => {
    const result = await requestPermission();
    setStatus(result);
  };

  if (status === 'granted') return (
    <div className="push-toggle-wrap">
      <span style={{ fontSize: '1.1rem' }}>🔔</span>
      <span style={{ flex: 1 }}>
        <strong style={{ fontSize: '.9rem' }}>Notificaciones activadas</strong><br />
        <small style={{ color: 'var(--muted)' }}>Te avisaré cuando se registre un partido.</small>
      </span>
      <span className="badge win">✓ Activo</span>
    </div>
  );

  if (status === 'denied') return (
    <div className="push-toggle-wrap">
      <span style={{ fontSize: '1.1rem' }}>🔕</span>
      <span style={{ flex: 1 }}>
        <strong style={{ fontSize: '.9rem' }}>Notificaciones bloqueadas</strong><br />
        <small style={{ color: 'var(--muted)' }}>Actívalas desde la configuración del navegador.</small>
      </span>
      <span className="badge danger">Bloqueado</span>
    </div>
  );

  return (
    <div className="push-toggle-wrap">
      <span style={{ fontSize: '1.1rem' }}>🔔</span>
      <span style={{ flex: 1 }}>
        <strong style={{ fontSize: '.9rem' }}>Activar notificaciones</strong><br />
        <small style={{ color: 'var(--muted)' }}>Recibe un aviso cuando se registre un partido.</small>
      </span>
      <button className="btn small" onClick={activar}>Activar</button>
    </div>
  );
}
