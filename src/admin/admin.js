// ============================================================
//  admin.js — Panel de administrador (Fase 2)
// ============================================================
import {
  getTodosUsuarios, cambiarRol, desactivarUsuario, activarUsuario,
  getTodasLigas, actualizarLiga, getPeticiones, responderPeticion,
  getMetricas
} from '../lib/db.js';
import { currentProfile, logout } from '../auth/auth.js';
import { toast } from '../lib/ui.js';

export async function renderAdminPanel(container) {
  container.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <span class="topbar-logo">🏐</span>
          <span class="topbar-title">Panel Admin</span>
          <span class="badge-role superadmin">${currentProfile.role === 'superadmin' ? '⭐ Superadmin' : '🛡 Admin'}</span>
        </div>
        <div class="topbar-right">
          <span class="topbar-user">${currentProfile.nombre || currentProfile.email}</span>
          <button class="btn secondary small" id="btn-logout-admin">Salir</button>
        </div>
      </header>

      <nav class="admin-nav">
        <button class="admin-nav-btn active" data-section="metricas">📊 Métricas</button>
        <button class="admin-nav-btn" data-section="ligas">🏆 Ligas</button>
        <button class="admin-nav-btn" data-section="usuarios">👤 Usuarios</button>
        <button class="admin-nav-btn" data-section="peticiones">📋 Peticiones</button>
      </nav>

      <main class="admin-main" id="admin-content">
        <div class="loading-spinner">Cargando…</div>
      </main>
    </div>`;

  container.querySelector('#btn-logout-admin').addEventListener('click', async () => {
    await logout();
  });

  container.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cargarSeccion(btn.dataset.section);
    });
  });

  cargarSeccion('metricas');

  async function cargarSeccion(seccion) {
    const main = container.querySelector('#admin-content');
    main.innerHTML = '<div class="loading-spinner">Cargando…</div>';
    if (seccion === 'metricas')   await renderMetricas(main);
    if (seccion === 'ligas')      await renderLigas(main);
    if (seccion === 'usuarios')   await renderUsuarios(main);
    if (seccion === 'peticiones') await renderPeticiones(main);
  }

  // ── Métricas ───────────────────────────────────────────────
  async function renderMetricas(el) {
    let metricas;
    try {
      metricas = await getMetricas();
    } catch (e) {
      el.innerHTML = '<p class="empty">Error al cargar métricas.</p>';
      return;
    }

    const { usuarios, ligas, partidos, equipos, ligasActivas, ligasInactivas, ultimosUsuarios, ultimasLigas } = metricas;

    el.innerHTML = `
      <div class="admin-section-header">
        <h2>📊 Métricas de la plataforma</h2>
      </div>

      <div class="metricas-grid">
        <div class="metrica-card">
          <div class="metrica-val">${usuarios}</div>
          <div class="metrica-lbl">👤 Usuarios</div>
        </div>
        <div class="metrica-card">
          <div class="metrica-val">${ligas}</div>
          <div class="metrica-lbl">🏆 Ligas totales</div>
          <div class="metrica-sub">
            <span class="badge win">${ligasActivas} activas</span>
            <span class="badge danger">${ligasInactivas} inactivas</span>
          </div>
        </div>
        <div class="metrica-card">
          <div class="metrica-val">${equipos}</div>
          <div class="metrica-lbl">👥 Equipos</div>
        </div>
        <div class="metrica-card">
          <div class="metrica-val">${partidos}</div>
          <div class="metrica-lbl">🏐 Partidos jugados</div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-top:1.2rem">
        <div>
          <h3 style="font-size:.95rem;margin-bottom:.7rem;color:var(--muted)">Usuarios recientes</h3>
          ${ultimosUsuarios.length === 0
            ? '<p class="empty">Sin usuarios.</p>'
            : ultimosUsuarios.map(u => `
              <div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--border)">
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.nombre || '—')}</div>
                  <div style="font-size:.75rem;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(u.email)}</div>
                </div>
                <span class="badge-role ${u.role}">${u.role === 'superadmin' ? '⭐' : u.role === 'admin' ? '🛡' : '🏆'}</span>
              </div>`).join('')}
        </div>

        <div>
          <h3 style="font-size:.95rem;margin-bottom:.7rem;color:var(--muted)">Ligas recientes</h3>
          ${ultimasLigas.length === 0
            ? '<p class="empty">Sin ligas.</p>'
            : ultimasLigas.map(l => `
              <div style="display:flex;align-items:center;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--border)">
                <div style="flex:1;min-width:0">
                  <div style="font-weight:600;font-size:.88rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l.nombre)}</div>
                  <div style="font-size:.75rem;color:var(--muted)">${esc(l.profiles?.nombre || l.profiles?.email || '—')}</div>
                </div>
                <span class="badge ${l.activa ? 'win' : 'danger'}">${l.activa ? 'Activa' : 'Inactiva'}</span>
              </div>`).join('')}
        </div>
      </div>`;
  }

  // ── Ligas ──────────────────────────────────────────────────
  async function renderLigas(el) {
    const ligas = await getTodasLigas();
    el.innerHTML = `
      <div class="admin-section-header">
        <h2>Todas las ligas <span class="badge">${ligas.length}</span></h2>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr>
            <th>Liga</th><th>Código</th><th>Organizador</th><th>Activa</th><th>Acciones</th>
          </tr></thead>
          <tbody>
          ${ligas.map(l => `
            <tr>
              <td><strong>${esc(l.nombre)}</strong><br><small class="muted">${esc(l.temporada||'')}</small></td>
              <td><code class="codigo-chip">${l.codigo}</code></td>
              <td>${esc(l.profiles?.nombre||l.profiles?.email||'—')}</td>
              <td>
                <span class="badge ${l.activa?'win':'danger'}">${l.activa?'Activa':'Inactiva'}</span>
              </td>
              <td>
                <button class="btn secondary small"
                  onclick="adminToggleLiga('${l.id}',${!l.activa})">
                  ${l.activa ? 'Desactivar' : 'Activar'}
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    window.adminToggleLiga = async (id, activa) => {
      await actualizarLiga(id, { activa });
      await renderLigas(el);
      toast(activa ? 'Liga activada' : 'Liga desactivada');
    };
  }

  // ── Usuarios ───────────────────────────────────────────────
  async function renderUsuarios(el) {
    const usuarios = await getTodosUsuarios();
    el.innerHTML = `
      <div class="admin-section-header">
        <h2>Usuarios <span class="badge">${usuarios.length}</span></h2>
      </div>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr>
            <th>Nombre / Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th>
          </tr></thead>
          <tbody>
          ${usuarios.map(u => `
            <tr>
              <td>
                <strong>${esc(u.nombre||'—')}</strong><br>
                <small class="muted">${esc(u.email)}</small>
              </td>
              <td>
                <span class="badge-role ${u.role}">${rolLabel(u.role)}</span>
              </td>
              <td>
                <span class="badge ${u.activo?'win':'danger'}">${u.activo?'Activo':'Inactivo'}</span>
              </td>
              <td class="admin-acciones">
                ${u.id === currentProfile.id ? '<span class="muted">Tú</span>' : `
                  ${currentProfile.role==='superadmin'?`
                    <select class="select-rol small" data-uid="${u.id}" onchange="adminCambiarRol('${u.id}',this.value)">
                      <option value="organizador" ${u.role==='organizador'?'selected':''}>Organizador</option>
                      <option value="admin"       ${u.role==='admin'?'selected':''}>Admin</option>
                      <option value="superadmin"  ${u.role==='superadmin'?'selected':''}>Superadmin</option>
                    </select>`:''}
                  <button class="btn ${u.activo?'danger':'secondary'} small"
                    onclick="adminToggleUser('${u.id}',${!u.activo})">
                    ${u.activo?'Desactivar':'Activar'}
                  </button>`}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    window.adminCambiarRol = async (uid, rol) => {
      try {
        await cambiarRol(uid, rol);
        toast('Rol actualizado');
      } catch(err) { toast(err.message, 'error'); }
    };

    window.adminToggleUser = async (uid, activo) => {
      try {
        activo ? await activarUsuario(uid) : await desactivarUsuario(uid);
        await renderUsuarios(el);
        toast(activo ? 'Usuario activado' : 'Usuario desactivado');
      } catch(err) { toast(err.message, 'error'); }
    };
  }

  // ── Peticiones ─────────────────────────────────────────────
  async function renderPeticiones(el) {
    const pets = await getPeticiones();
    const pendientes = pets.filter(p => p.estado === 'pendiente');
    el.innerHTML = `
      <div class="admin-section-header">
        <h2>Peticiones de liga extra <span class="badge">${pendientes.length} pendientes</span></h2>
      </div>
      ${!pets.length ? '<p class="empty">No hay peticiones.</p>' : `
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead><tr><th>Organizador</th><th>Mensaje</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
          ${pets.map(p => `
            <tr>
              <td>${esc(p.profiles?.nombre||p.profiles?.email||'—')}</td>
              <td>${esc(p.mensaje||'—')}</td>
              <td><span class="badge ${estadoBadge(p.estado)}">${p.estado}</span></td>
              <td>
                ${p.estado==='pendiente'?`
                  <button class="btn small" onclick="adminPeticion('${p.id}','aprobada')">✓ Aprobar</button>
                  <button class="btn danger small" onclick="adminPeticion('${p.id}','rechazada')">✕ Rechazar</button>
                `:'—'}
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`}`;

    window.adminPeticion = async (id, estado) => {
      await responderPeticion(id, estado);
      await renderPeticiones(el);
      toast(estado === 'aprobada' ? 'Petición aprobada' : 'Petición rechazada');
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────
function esc(s) { return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function rolLabel(r) { return {superadmin:'⭐ Superadmin', admin:'🛡 Admin', organizador:'🏆 Organizador'}[r] || r; }
function estadoBadge(e) { return {pendiente:'pending', aprobada:'win', rechazada:'danger'}[e] || ''; }
