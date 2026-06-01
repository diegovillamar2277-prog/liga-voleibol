// ============================================================
//  Toast.jsx — Sistema de toasts React
//  Uso: montar <ToastContainer /> una vez en App,
//       luego llamar toast('mensaje', 'ok'|'error'|'warn')
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';

// ── Evento global para disparar toasts desde cualquier módulo ─
const TOAST_EVENT = 'liga:toast';

export function toast(msg, tipo = 'ok', duracion = 3000) {
  document.dispatchEvent(new CustomEvent(TOAST_EVENT, {
    detail: { msg, tipo, duracion, id: Date.now() + Math.random() }
  }));
}

// ── Contenedor que renderiza los toasts ──────────────────────
export function ToastContainer() {
  const [toasts, setToasts] = useState([]);

  const remove = useCallback(id => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = ({ detail }) => {
      setToasts(prev => [...prev, detail]);
      setTimeout(() => remove(detail.id), detail.duracion + 400);
    };
    document.addEventListener(TOAST_EVENT, handler);
    return () => document.removeEventListener(TOAST_EVENT, handler);
  }, [remove]);

  return (
    <div style={{ position: 'fixed', bottom: '1.5rem', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '.4rem', alignItems: 'center' }}>
      {toasts.map(t => (
        <ToastItem key={t.id} {...t} onDone={() => remove(t.id)} />
      ))}
    </div>
  );
}

function ToastItem({ msg, tipo, duracion, onDone }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    const hide = setTimeout(() => setVisible(false), duracion);
    const done = setTimeout(onDone, duracion + 400);
    return () => { cancelAnimationFrame(show); clearTimeout(hide); clearTimeout(done); };
  }, []);

  return (
    <div className={`toast toast-${tipo} ${visible ? 'toast-visible' : ''}`}>
      {msg}
    </div>
  );
}
