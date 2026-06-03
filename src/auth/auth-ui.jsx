// ============================================================
//  auth-ui.jsx — Pantalla de Login / Registro (React)
// ============================================================
import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { login, register } from './auth.js';

let _root = null;
let _container = null;

export function unmountAuthScreen() {
  if (_root) { _root.unmount(); _root = null; _container = null; }
}

export function renderAuthScreen(container) {
  if (_root && _container !== container) {
    _root.unmount(); _root = null;
  }
  if (!_root) {
    _root = createRoot(container);
    _container = container;
  }
  _root.render(<AuthScreen />);
}

// ════════════════════════════════════════════════════════════
//  COMPONENTE
// ════════════════════════════════════════════════════════════
function AuthScreen() {
  const [tab, setTab]           = useState('login');
  const [email, setEmail]       = useState('');
  const [pass, setPass]         = useState('');
  const [nombre, setNombre]     = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass]   = useState('');
  const [error, setError]       = useState('');
  const [regError, setRegError] = useState('');
  const [regOk, setRegOk]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleLogin = async e => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await login(email, pass);
      // onAuthStateChange en auth.js dispara 'auth-change' → main.js enruta
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async e => {
    e.preventDefault();
    setRegError(''); setRegOk(''); setLoading(true);
    try {
      await register(regEmail, regPass, nombre);
      setRegOk('¡Cuenta creada! Ya puedes iniciar sesión.');
      setNombre(''); setRegEmail(''); setRegPass('');
    } catch (err) {
      setRegError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Vuelve a la vista pública (buscador de liga)
  const irAInicio = e => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('nav', { detail: { page: 'codigo' } }));
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-logo">🏐</div>
        <h1 className="auth-title">Liga Voleibol</h1>
        <p className="auth-sub">Panel de gestión</p>

        <div className="auth-tabs">
          <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`} onClick={() => setTab('login')}>
            Iniciar sesión
          </button>
          <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`} onClick={() => setTab('register')}>
            Registrarse
          </button>
        </div>

        {tab === 'login' && (
          <form className="auth-form" onSubmit={handleLogin}>
            <div className="auth-field">
              <label>Correo</label>
              <input type="email" placeholder="tu@correo.com" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="auth-field">
              <label>Contraseña</label>
              <input type="password" placeholder="••••••••" required autoComplete="current-password"
                value={pass} onChange={e => setPass(e.target.value)} />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-btn btn" disabled={loading}>
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        )}

        {tab === 'register' && (
          <form className="auth-form" onSubmit={handleRegister}>
            <div className="auth-field">
              <label>Tu nombre</label>
              <input type="text" placeholder="Nombre completo" required
                value={nombre} onChange={e => setNombre(e.target.value)} />
            </div>
            <div className="auth-field">
              <label>Correo</label>
              <input type="email" placeholder="tu@correo.com" required autoComplete="email"
                value={regEmail} onChange={e => setRegEmail(e.target.value)} />
            </div>
            <div className="auth-field">
              <label>Contraseña <small>(mínimo 6 caracteres)</small></label>
              <input type="password" placeholder="••••••••" required minLength={6} autoComplete="new-password"
                value={regPass} onChange={e => setRegPass(e.target.value)} />
            </div>
            {regError && <div className="auth-error">{regError}</div>}
            {regOk    && <div className="auth-success">{regOk}</div>}
            <button type="submit" className="auth-btn btn" disabled={loading}>
              {loading ? 'Creando cuenta…' : 'Crear cuenta'}
            </button>
          </form>
        )}

        <p className="auth-footer" style={{ marginTop: '1.2rem' }}>
          <a href="#" onClick={irAInicio}>← Ver liga sin iniciar sesión</a>
        </p>
      </div>
    </div>
  );
}
