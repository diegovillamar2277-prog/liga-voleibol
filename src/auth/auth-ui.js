// ============================================================
//  auth-ui.js — Pantalla de Login / Registro (Fase 2: botón atrás)
// ============================================================
import { login, register, currentProfile } from './auth.js';

export function renderAuthScreen(container) {
  container.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card">
        <div class="auth-logo">🏐</div>
        <h1 class="auth-title">Liga Voleibol</h1>
        <p class="auth-sub">Panel de gestión</p>

        <div class="auth-tabs">
          <button class="auth-tab active" data-tab="login">Iniciar sesión</button>
          <button class="auth-tab" data-tab="register">Registrarse</button>
        </div>

        <!-- LOGIN -->
        <form id="form-login" class="auth-form">
          <div class="auth-field">
            <label>Correo</label>
            <input type="email" id="login-email" placeholder="tu@correo.com" required autocomplete="email">
          </div>
          <div class="auth-field">
            <label>Contraseña</label>
            <input type="password" id="login-pass" placeholder="••••••••" required autocomplete="current-password">
          </div>
          <div id="login-error" class="auth-error" style="display:none"></div>
          <button type="submit" class="auth-btn btn" id="btn-login">Entrar</button>
        </form>

        <!-- REGISTRO -->
        <form id="form-register" class="auth-form" style="display:none">
          <div class="auth-field">
            <label>Tu nombre</label>
            <input type="text" id="reg-nombre" placeholder="Nombre completo" required>
          </div>
          <div class="auth-field">
            <label>Correo</label>
            <input type="email" id="reg-email" placeholder="tu@correo.com" required autocomplete="email">
          </div>
          <div class="auth-field">
            <label>Contraseña <small>(mínimo 6 caracteres)</small></label>
            <input type="password" id="reg-pass" placeholder="••••••••" required minlength="6" autocomplete="new-password">
          </div>
          <div id="reg-error" class="auth-error" style="display:none"></div>
          <div id="reg-success" class="auth-success" style="display:none"></div>
          <button type="submit" class="auth-btn btn" id="btn-register">Crear cuenta</button>
        </form>

        <div class="auth-footer-links">
          <p class="auth-footer">
            ¿Solo quieres ver tu liga?
            <a href="#" id="link-codigo">Ingresa con código →</a>
          </p>
          <p class="auth-footer" style="margin-top:.4rem">
            <a href="#" id="link-volver">← Volver al inicio</a>
          </p>
        </div>
      </div>
    </div>`;

  // Tabs
  container.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const isLogin = tab.dataset.tab === 'login';
      container.querySelector('#form-login').style.display    = isLogin ? '' : 'none';
      container.querySelector('#form-register').style.display = isLogin ? 'none' : '';
    });
  });

  // Login submit
  container.querySelector('#form-login').addEventListener('submit', async e => {
    e.preventDefault();
    const btn   = container.querySelector('#btn-login');
    const errEl = container.querySelector('#login-error');
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Entrando…';
    try {
      await login(
        container.querySelector('#login-email').value.trim(),
        container.querySelector('#login-pass').value
      );
      // onAuthStateChange se encarga del redirect
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'Entrar';
    }
  });

  // Register submit
  container.querySelector('#form-register').addEventListener('submit', async e => {
    e.preventDefault();
    const btn   = container.querySelector('#btn-register');
    const errEl = container.querySelector('#reg-error');
    const okEl  = container.querySelector('#reg-success');
    errEl.style.display = 'none'; okEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Creando cuenta…';
    try {
      await register(
        container.querySelector('#reg-email').value.trim(),
        container.querySelector('#reg-pass').value,
        container.querySelector('#reg-nombre').value.trim()
      );
      okEl.textContent = '¡Cuenta creada! Ya puedes iniciar sesión.';
      okEl.style.display = 'block';
      e.target.reset();
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false; btn.textContent = 'Crear cuenta';
    }
  });

  // Link a acceso por código
  container.querySelector('#link-codigo').addEventListener('click', e => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('nav', { detail: { page: 'codigo' } }));
  });

  // ← Volver al inicio (bug 1 fix)
  container.querySelector('#link-volver').addEventListener('click', e => {
    e.preventDefault();
    document.dispatchEvent(new CustomEvent('nav', { detail: { page: 'home' } }));
  });
}
