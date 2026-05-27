// ============================================================
//  liga-dashboard.js — Vista del organizador de su liga (Fase 2)
// ============================================================
import { sb } from '../lib/supabase.js';
import { logout } from '../auth/auth.js';
import {
  getLigaById, getMisLigas, actualizarLiga, renovarCodigo,
  getEquipos, agregarEquipo, actualizarEquipo, eliminarEquipo,
  getPartidos, guardarPartido, actualizarPartido, eliminarPartido,
  getPlayoffs, guardarPlayoffs,
  invitarCoAdmin, quitarMiembro, getMiembros,
  contarLigasDeUsuario, crearLiga, enviarPeticion
} from '../lib/db.js';
import { toast, esc, formatFecha, confirmar } from '../lib/ui.js';

let LIGA     = null;
let equipos  = [];
let partidos = [];

const getContent = () => document.querySelector('#liga-content');

async function getPerfil() {
  const mod = await import('../auth/auth.js');
  return mod.currentProfile;
}

// ════════════════════════════════════════════════════════════
//  ENTRADA PRINCIPAL
// ════════════════════════════════════════════════════════════
export async function renderOrgPanel(container) {
  const perfil = await getPerfil();
  if (!perfil) { container.innerHTML = '<p class="empty">Error de sesión. Recarga la página.</p>'; return; }

  container.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <span class="topbar-logo">🏐</span>
          <span class="topbar-title" id="topbar-liga-nombre">Mis ligas</span>
        </div>
        <div class="topbar-right">
          <span class="topbar-user">${esc(perfil.nombre || perfil.email)}</span>
          <button class="btn secondary small" id="btn-logout-org">Salir</button>
        </div>
      </header>
      <main id="org-main"></main>
    </div>`;

  container.querySelector('#btn-logout-org').addEventListener('click', logout);
  const misLigas = await getMisLigas(perfil.id);

  if (!misLigas.length) {
    renderSinLigas(container.querySelector('#org-main'));
  } else if (misLigas.length === 1) {
    localStorage.setItem('liga_ultima', misLigas[0].id);
    await abrirLiga(misLigas[0], container.querySelector('#org-main'));
  } else {
    renderSelectorLigas(misLigas, container.querySelector('#org-main'));
  }
}

// ── Sin ligas ────────────────────────────────────────────────
function renderSinLigas(el) {
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🏐</div>
      <h2>No tienes ligas aún</h2>
      <p class="muted">Crea tu primera liga para empezar.</p>
      <button class="btn" id="btn-crear-primera">+ Crear mi primera liga</button>
    </div>`;
  el.querySelector('#btn-crear-primera').onclick = () => renderFormCrearLiga(el);
}

// ── Selector de ligas mejorado ───────────────────────────────
function renderSelectorLigas(ligas, el) {
  const ultimaId = localStorage.getItem('liga_ultima');

  el.innerHTML = `
    <div class="ligas-selector">
      <div class="selector-header">
        <h2>Mis ligas</h2>
        <span class="badge pending">${ligas.length} liga${ligas.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="ligas-grid">
        ${ligas.map(l => {
          const esUltima = l.id === ultimaId;
          return `
          <div class="liga-card ${esUltima ? 'liga-card-ultima' : ''}" data-id="${l.id}">
            ${esUltima ? '<div class="liga-card-badge-ultima">Última visitada</div>' : ''}
            <div class="liga-card-nombre">${esc(l.nombre)}</div>
            <div class="liga-card-temp muted">${esc(l.temporada || '—')}</div>
            <div class="liga-card-codigo"><code>${l.alias || l.codigo}</code></div>
            <div class="liga-card-stats">
              <span>👥 <strong>—</strong> equipos</span>
              <span>🏐 <strong>—</strong> partidos</span>
            </div>
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:.4rem">
              <span class="badge ${l.miRol === 'owner' ? 'win' : 'pending'}">${l.miRol === 'owner' ? 'Propietario' : 'Co-admin'}</span>
              <span class="badge ${l.activa ? 'done' : 'danger'}">${l.activa ? 'Activa' : 'Inactiva'}</span>
            </div>
          </div>`;
        }).join('')}
        ${ligas.filter(l => l.miRol === 'owner').length < 2 ? `
          <div class="liga-card liga-card-nueva" id="btn-nueva-liga">
            <div class="liga-card-nueva-icon">＋</div>
            <div class="liga-card-nombre">Nueva liga</div>
          </div>` : ''}
      </div>
    </div>`;

  // Cargar stats reales
  ligas.forEach(async l => {
    try {
      const [eqs, pts] = await Promise.all([getEquipos(l.id), getPartidos(l.id)]);
      const card = el.querySelector(`.liga-card[data-id="${l.id}"]`);
      if (!card) return;
      const statsEl = card.querySelector('.liga-card-stats');
      if (statsEl) {
        const pj = pts.filter(p => p.jugado && !p.es_playoff).length;
        statsEl.innerHTML = `
          <span>👥 <strong>${eqs.length}</strong> equipos</span>
          <span>🏐 <strong>${pj}</strong> partidos</span>`;
      }
    } catch (_) {}
  });

  el.querySelectorAll('.liga-card[data-id]').forEach(card => {
    card.onclick = async () => {
      const liga = ligas.find(l => l.id === card.dataset.id);
      localStorage.setItem('liga_ultima', liga.id);
      await abrirLiga(liga, el);
    };
  });

  const btnNueva = el.querySelector('#btn-nueva-liga');
  if (btnNueva) btnNueva.onclick = () => renderFormCrearLiga(el);
}

// ── Crear liga ───────────────────────────────────────────────
async function renderFormCrearLiga(el) {
  const perfil = await getPerfil();
  if (!perfil) { toast('Error de sesión, recarga', 'error'); return; }

  const total = await contarLigasDeUsuario(perfil.id);
  if (total >= 2) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h2>Límite de 2 ligas alcanzado</h2>
        <p class="muted">Envía una petición al administrador para crear más.</p>
        <form id="form-peticion" style="max-width:400px;margin:1.5rem auto 0">
          <textarea id="pet-mensaje" rows="3" style="width:100%;padding:.6rem;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text)"
            placeholder="¿Por qué necesitas más ligas?"></textarea>
          <div id="pet-error" class="auth-error" style="display:none"></div>
          <button type="submit" class="btn" style="margin-top:.6rem">Enviar petición</button>
        </form>
      </div>`;
    el.querySelector('#form-peticion').onsubmit = async e => {
      e.preventDefault();
      const msg = el.querySelector('#pet-mensaje').value.trim();
      if (!msg) { toast('Escribe un mensaje', 'error'); return; }
      try { await enviarPeticion(perfil.id, msg); toast('Petición enviada ✓'); }
      catch(err) { toast(err.message, 'error'); }
    };
    return;
  }

  el.innerHTML = `
    <div class="empty-state" style="max-width:480px">
      <h2>Nueva liga</h2>
      <form id="form-crear-liga">
        <div class="auth-field">
          <label>Nombre de la liga *</label>
          <input type="text" id="nueva-nombre" placeholder="Liga Voleibol 2025" required maxlength="60">
        </div>
        <div class="auth-field">
          <label>Temporada / Año</label>
          <input type="text" id="nueva-temp" placeholder="2025" maxlength="20">
        </div>
        <div id="crear-error" class="auth-error" style="display:none"></div>
        <div class="flex" style="gap:.6rem;margin-top:1rem">
          <button type="submit" class="btn">Crear liga</button>
          <button type="button" class="btn secondary" id="btn-cancelar-crear">Cancelar</button>
        </div>
      </form>
    </div>`;

  el.querySelector('#btn-cancelar-crear').onclick = () => renderOrgPanel(document.querySelector('#app'));
  el.querySelector('#form-crear-liga').onsubmit = async e => {
    e.preventDefault();
    const nombre = el.querySelector('#nueva-nombre').value.trim();
    const temp   = el.querySelector('#nueva-temp').value.trim();
    const errEl  = el.querySelector('#crear-error');
    errEl.style.display = 'none';
    try {
      const p = await getPerfil();
      if (!p?.id) throw new Error('Sesión no válida, recarga la página');
      const liga = await crearLiga({ nombre, temporada: temp, ownerId: p.id, config: {}, reglas: [], playoffsCfg: {} });
      toast('Liga creada ✓');
      await abrirLiga(liga, el);
    } catch(err) { errEl.textContent = err.message; errEl.style.display = 'block'; }
  };
}

// ════════════════════════════════════════════════════════════
//  VISTA PRINCIPAL DE LA LIGA
// ════════════════════════════════════════════════════════════
async function abrirLiga(ligaData, el) {
  LIGA     = await getLigaById(ligaData.id);
  equipos  = await getEquipos(LIGA.id);
  partidos = await getPartidos(LIGA.id);

  const topbar = document.querySelector('#topbar-liga-nombre');
  if (topbar) topbar.textContent = LIGA.nombre;

  el.innerHTML = `
    <nav class="tab-nav" id="liga-nav">
      <button data-tab="tabla"    class="active">Tabla</button>
      <button data-tab="fixture"  >Fixture</button>
      <button data-tab="partidos" >Partidos</button>
      <button data-tab="equipos"  >Equipos</button>
      <button data-tab="playoffs" >🏆 Playoffs</button>
      <button data-tab="finanzas" >💰 Finanzas</button>
      <button data-tab="config"   >⚙ Config</button>
    </nav>
    <section id="liga-content" class="section"></section>`;

  el.querySelectorAll('#liga-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#liga-nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab(btn.dataset.tab);
    });
  });

  renderTab('tabla');
}

async function renderTab(tab) {
  const el = getContent();
  if (!el) return;
  equipos  = await getEquipos(LIGA.id);
  partidos = await getPartidos(LIGA.id);
  LIGA     = await getLigaById(LIGA.id);

  if (tab === 'tabla')    renderTabla(el);
  if (tab === 'fixture')  renderFixture(el);
  if (tab === 'partidos') renderPartidos(el);
  if (tab === 'equipos')  renderEquiposTab(el);
  if (tab === 'playoffs') renderPlayoffsTab(el);
  if (tab === 'finanzas') renderFinanzas(el);
  if (tab === 'config')   renderConfigTab(el);
}

// ── Tabla ────────────────────────────────────────────────────
function renderTabla(el) {
  const cfg      = LIGA.config || {};
  const usarPts  = cfg.usarPuntos  !== false;
  const usarSets = cfg.usarSets    !== false;
  const tabla    = calcularTabla(equipos, partidos, cfg);

  el.innerHTML = `
    <h2>Tabla de <span>Posiciones</span></h2>
    <div class="tabla-wrap">
      <table class="tabla-pos">
        <thead><tr>
          <th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th>
          ${usarSets ? '<th>SG</th><th>SP</th>' : ''}
          ${usarSets && cfg.mostrarColDifSets!==false ? '<th>DS</th>' : ''}
          ${usarPts ? '<th>PTS</th>' : ''}
        </tr></thead>
        <tbody>
          ${tabla.map((r,i) => `
            <tr>
              <td>${i+1}</td>
              <td>${esc(r.equipo)}</td>
              <td>${r.pj}</td><td class="green">${r.pg}</td><td class="red">${r.pp}</td>
              ${usarSets ? `<td>${r.sg}</td><td>${r.sp}</td>` : ''}
              ${usarSets && cfg.mostrarColDifSets!==false ? `<td class="${r.sg-r.sp>0?'green':r.sg-r.sp<0?'red':''}">${r.sg-r.sp>0?'+':''}${r.sg-r.sp}</td>` : ''}
              ${usarPts ? `<td class="pts-cell">${r.pts}</td>` : ''}
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

// ── Fixture ──────────────────────────────────────────────────
function renderFixture(el) {
  const cfg     = LIGA.config || {};
  const vueltas = cfg.vueltas || 2;
  const noms    = equipos.map(e => e.nombre);
  const fixture = generarFixture(noms);

  let html = `<h2>Fixture</h2>`;
  for (let v = 1; v <= vueltas; v++) {
    html += `<h3 style="margin-top:1.2rem">Vuelta ${v}</h3><div class="fixture-list">`;
    fixture.forEach(enc => {
      const eA = v===1 ? enc.local : enc.visitante;
      const eB = v===1 ? enc.visitante : enc.local;
      const partido = partidos.find(p =>
        !p.es_playoff && p.vuelta===v &&
        ((p.equipo_a===eA&&p.equipo_b===eB)||(p.equipo_a===eB&&p.equipo_b===eA))
      );
      const jugado = partido?.jugado;
      html += `<div class="fixture-item ${jugado?'jugado':''}">
        <span class="badge ${v===1?'pending':'done'}">V${v}</span>
        <div class="fixture-teams">
          <span>${esc(eA)}</span>
          <span class="fixture-vs">${jugado ? `${partido.sets_a}:${partido.sets_b}` : 'vs'}</span>
          <span>${esc(eB)}</span>
        </div>
        ${partido?.fecha ? `<span class="fixture-date">${formatFecha(partido.fecha)}</span>` : ''}
      </div>`;
    });
    html += `</div>`;
  }
  el.innerHTML = html;
}

// ── Partidos ─────────────────────────────────────────────────
function renderPartidos(el) {
  const cfg      = LIGA.config || {};
  const usarSets = cfg.usarSets !== false;
  const reglas   = LIGA.reglas?.length ? LIGA.reglas : REGLAS_DEFAULT;
  const norm     = partidos.filter(p => !p.es_playoff);

  el.innerHTML = `
    <h2>Registrar <span>Partido</span></h2>
    <div class="card">
      <form id="form-partido-liga">
        <div class="form-row">
          <div class="form-group">
            <label>Vuelta</label>
            <select id="p-vuelta">
              ${Array.from({length: cfg.vueltas||2},(_,i)=>`<option value="${i+1}">Vuelta ${i+1}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Fecha *</label>
            <input type="date" id="p-fecha" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Equipo A</label>
            <select id="p-eqA">
              <option value="">— Seleccionar —</option>
              ${equipos.map(e=>`<option value="${esc(e.nombre)}">${esc(e.nombre)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Equipo B</label>
            <select id="p-eqB">
              <option value="">— Seleccionar —</option>
              ${equipos.map(e=>`<option value="${esc(e.nombre)}">${esc(e.nombre)}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="p-sets-container" style="margin-top:1rem"></div>
        <div class="flex mt1">
          <button type="submit" class="btn">Guardar partido</button>
          <button type="reset" class="btn secondary">Limpiar</button>
        </div>
      </form>
    </div>
    <h2 style="margin-top:2rem">Partidos <span>Registrados</span></h2>
    <div id="lista-partidos-liga">
      ${!norm.length ? '<p class="empty">No hay partidos aún.</p>' :
        [...norm].sort((a,b)=>a.vuelta-b.vuelta).map(p => {
          const ganN = p.ganador==='A' ? p.equipo_a : p.equipo_b;
          return `<div class="fixture-item">
            <span class="badge ${p.vuelta===1?'pending':'done'}">V${p.vuelta}</span>
            <div class="fixture-teams">
              <span>${esc(p.equipo_a)}</span>
              <span class="fixture-vs">${usarSets?`${p.sets_a}:${p.sets_b}`:'G:P'}</span>
              <span>${esc(p.equipo_b)}</span>
            </div>
            ${p.fecha?`<span class="fixture-date">${formatFecha(p.fecha)}</span>`:''}
            <span class="badge win">🏆 ${esc(ganN)}</span>
            <button class="btn danger small" onclick="eliminarPartidoLiga('${p.id}')">Eliminar</button>
          </div>`;
        }).join('')}
    </div>`;

  buildSetsFormLiga(el.querySelector('#p-sets-container'), reglas, usarSets);

  el.querySelector('#form-partido-liga').addEventListener('submit', async e => {
    e.preventDefault();
    const eA     = el.querySelector('#p-eqA').value;
    const eB     = el.querySelector('#p-eqB').value;
    const vuelta = parseInt(el.querySelector('#p-vuelta').value);
    const fecha  = el.querySelector('#p-fecha').value;
    if (!eA || !eB) { toast('Selecciona ambos equipos', 'error'); return; }
    if (eA === eB)  { toast('Los equipos deben ser diferentes', 'error'); return; }
    if (!fecha)     { toast('La fecha es obligatoria', 'error'); return; }

    let sets=[], sA=0, sB=0, ganador=null;
    if (!usarSets) {
      const rad = el.querySelector('input[name="ganador-simple"]:checked');
      if (!rad) { toast('Selecciona quién ganó', 'error'); return; }
      ganador = rad.value; sA = ganador==='A'?1:0; sB = ganador==='B'?1:0;
    } else {
      const res = leerSets(el, reglas);
      if (!res.ok) { toast(res.msg, 'error'); return; }
      sets = res.sets; sA = res.sA; sB = res.sB; ganador = res.ganador;
    }

    const existe = partidos.some(p =>
      !p.es_playoff && p.vuelta===vuelta &&
      ((p.equipo_a===eA&&p.equipo_b===eB)||(p.equipo_a===eB&&p.equipo_b===eA))
    );
    if (existe) { toast('Ya existe este partido en esa vuelta', 'error'); return; }

    try {
      await guardarPartido(LIGA.id, {
        vuelta, fecha, equipo_a:eA, equipo_b:eB,
        sets, sets_a:sA, sets_b:sB, ganador, jugado:true,
        pago_arb_a:false, pago_arb_b:false
      });
      toast(`✓ ${eA} ${sA}:${sB} ${eB}`);
      e.target.reset();
      renderTab('partidos');
    } catch(err) { toast(err.message, 'error'); }
  });

  window.eliminarPartidoLiga = async id => {
    if (!confirmar('¿Eliminar este partido?')) return;
    await eliminarPartido(id);
    renderTab('partidos');
    toast('Partido eliminado');
  };
}

// ── Equipos ──────────────────────────────────────────────────
function renderEquiposTab(el) {
  el.innerHTML = `
    <h2>Equipos</h2>
    <div class="card">
      <div class="form-row">
        <input type="text" id="nuevo-equipo" placeholder="Nombre del equipo" maxlength="40" style="flex:1">
        <button class="btn" id="btn-add-equipo">+ Agregar</button>
      </div>
    </div>
    <div id="lista-equipos-liga" style="margin-top:1rem">
      ${!equipos.length ? '<p class="empty">No hay equipos registrados.</p>' :
        equipos.map(e => `
          <div class="fixture-item">
            <span style="font-weight:600;flex:1">${esc(e.nombre)}</span>
            <button class="btn danger small" onclick="eliminarEquipoLiga('${e.id}')">Eliminar</button>
          </div>`).join('')}
    </div>`;

  el.querySelector('#btn-add-equipo').onclick = async () => {
    const inp = el.querySelector('#nuevo-equipo');
    const nom = inp.value.trim();
    if (!nom) { toast('Escribe un nombre', 'error'); return; }
    if (equipos.some(e=>e.nombre.toLowerCase()===nom.toLowerCase())) { toast('Nombre duplicado', 'error'); return; }
    await agregarEquipo(LIGA.id, nom);
    inp.value = '';
    renderTab('equipos');
    toast('Equipo agregado ✓');
  };

  window.eliminarEquipoLiga = async id => {
    if (!confirmar('¿Eliminar este equipo?')) return;
    await eliminarEquipo(id);
    renderTab('equipos');
    toast('Equipo eliminado');
  };
}

// ════════════════════════════════════════════════════════════
//  PLAYOFFS (Fase 2)
// ════════════════════════════════════════════════════════════
async function renderPlayoffsTab(el) {
  const playoffsCfg = LIGA.playoffs_cfg || {};
  const bracket     = await getPlayoffs(LIGA.id);

  if (!bracket) {
    renderPlayoffsSetup(el, playoffsCfg);
    return;
  }

  renderBracket(el, bracket, playoffsCfg);
}

function renderPlayoffsSetup(el, playoffsCfg) {
  const tabla    = calcularTabla(equipos, partidos, LIGA.config || {});
  const formato  = playoffsCfg.formato      || 'eliminacion';
  const nEquipos = playoffsCfg.equiposCount || Math.min(4, equipos.length);
  const cruces   = playoffsCfg.cruces       || 'automatico';

  el.innerHTML = `
    <h2>🏆 <span>Playoffs</span></h2>

    <div class="card">
      <p class="card-subtitle">⚙ Configuración de Playoffs</p>
      <div class="form-row">
        <div class="form-group">
          <label>Formato</label>
          <select id="po-formato">
            <option value="eliminacion" ${formato === 'eliminacion' ? 'selected' : ''}>Eliminación directa</option>
            <option value="liguilla"    ${formato === 'liguilla'    ? 'selected' : ''}>Liguilla (todos vs todos)</option>
          </select>
        </div>
        <div class="form-group" id="po-nequipos-wrap" ${formato === 'liguilla' ? 'style="display:none"' : ''}>
          <label>Equipos clasificados</label>
          <select id="po-nequipos">
            ${[4, 8, 16].filter(n => n <= equipos.length).map(n =>
              `<option value="${n}" ${nEquipos == n ? 'selected' : ''}>${n} equipos</option>`
            ).join('')}
            ${equipos.length < 4 && equipos.length > 0 ? `<option value="${equipos.length}" ${nEquipos == equipos.length ? 'selected' : ''}>${equipos.length} equipos</option>` : ''}
          </select>
        </div>
        <div class="form-group">
          <label>Asignación de cruces</label>
          <select id="po-cruces">
            <option value="automatico" ${cruces === 'automatico' ? 'selected' : ''}>Automático (por tabla)</option>
            <option value="manual"     ${cruces === 'manual'     ? 'selected' : ''}>Manual (en orden)</option>
          </select>
        </div>
      </div>
      <div class="flex mt1">
        <button class="btn" id="btn-guardar-cfg-playoffs">💾 Guardar configuración</button>
        <button class="btn secondary" id="btn-generar-bracket">🚀 Generar bracket</button>
      </div>
    </div>

    <div class="card" style="margin-top:1rem">
      <p class="card-subtitle">📊 Clasificación actual</p>
      <div class="po-clasificacion">
        ${tabla.length === 0
          ? '<p class="empty">No hay equipos en la tabla aún.</p>'
          : tabla.map((r, i) => `
            <div class="po-clas-row ${i < nEquipos ? 'clasificado' : ''}">
              <span class="po-clas-pos">${i + 1}</span>
              <span class="po-clas-nom">${esc(r.equipo)}</span>
              <span class="po-clas-pts badge ${i < nEquipos ? 'win' : ''}">${i < nEquipos ? '✓ Clasifica' : 'No clasifica'}</span>
            </div>`).join('')}
      </div>
    </div>`;

  el.querySelector('#po-formato').onchange = function() {
    const wrap = el.querySelector('#po-nequipos-wrap');
    if (wrap) wrap.style.display = this.value === 'liguilla' ? 'none' : '';
  };

  el.querySelector('#btn-guardar-cfg-playoffs').onclick = async () => {
    const nuevaCfg = {
      ...playoffsCfg,
      formato:      el.querySelector('#po-formato').value,
      equiposCount: parseInt(el.querySelector('#po-nequipos')?.value || 4),
      cruces:       el.querySelector('#po-cruces').value,
    };
    await actualizarLiga(LIGA.id, { playoffs_cfg: nuevaCfg });
    LIGA.playoffs_cfg = nuevaCfg;
    toast('Configuración guardada ✓');
    renderTab('playoffs');
  };

  el.querySelector('#btn-generar-bracket').onclick = async () => {
    const btn   = el.querySelector('#btn-generar-bracket');
    const fmt   = el.querySelector('#po-formato').value;
    const cruce = el.querySelector('#po-cruces').value;

    // Para liguilla el select está oculto — usar total de equipos
    const nSelect = el.querySelector('#po-nequipos');
    const n = (fmt === 'liguilla' || !nSelect)
      ? equipos.length
      : parseInt(nSelect.value) || equipos.length;

    const nuevaCfg = { ...playoffsCfg, formato: fmt, equiposCount: n, cruces: cruce };
    await actualizarLiga(LIGA.id, { playoffs_cfg: nuevaCfg });
    LIGA.playoffs_cfg = nuevaCfg;

    // Clasificados: usar tabla si hay partidos, si no usar equipos en orden de creación
    const tablaActual = calcularTabla(equipos, partidos, LIGA.config || {});
    const clasificados = tablaActual.length > 0
      ? tablaActual.slice(0, n).map(r => r.equipo)
      : equipos.slice(0, n).map(e => e.nombre);

    if (clasificados.length < 2) {
      toast('Necesitas al menos 2 equipos para generar el bracket', 'error');
      return;
    }

    btn.disabled = true; btn.textContent = 'Generando…';
    try {
      const bracket = fmt === 'eliminacion'
        ? generarBracketEliminacion(clasificados, cruce)
        : generarBracketLiguilla(clasificados);

      await guardarPlayoffs(LIGA.id, bracket);
      toast('Bracket generado ✓');
      await renderTab('playoffs');
    } catch(err) {
      toast('Error al generar bracket: ' + err.message, 'error');
    } finally {
      btn.disabled = false; btn.textContent = '🚀 Generar bracket';
    }
  };
}

function generarBracketEliminacion(clasificados, cruces) {
  const n = clasificados.length;
  let emparejados = [];

  if (cruces === 'automatico') {
    const mitad = Math.floor(n / 2);
    for (let i = 0; i < mitad; i++) {
      emparejados.push([clasificados[i], clasificados[n - 1 - i]]);
    }
  } else {
    for (let i = 0; i < n; i += 2) {
      emparejados.push([clasificados[i], clasificados[i + 1] || 'BYE']);
    }
  }

  const nombresRondas = {
    2: ['Final'],
    4: ['Semifinales', 'Final'],
    8: ['Cuartos de final', 'Semifinales', 'Final'],
    16: ['Octavos de final', 'Cuartos de final', 'Semifinales', 'Final'],
  };
  const totalRondas = Math.ceil(Math.log2(n));
  const listaRondas = nombresRondas[n] || Array.from({ length: totalRondas }, (_, i) => `Ronda ${i + 1}`);

  const rondas = [];
  rondas.push({
    nombre: listaRondas[0],
    partidos: emparejados.map((par, i) => ({
      id: `r0p${i}`,
      equipoA: par[0],
      equipoB: par[1],
      setsA: null,
      setsB: null,
      ganador: par[1] === 'BYE' ? 'A' : null,
    }))
  });

  let partidosAnt = emparejados.length;
  for (let r = 1; r < listaRondas.length; r++) {
    const partidosRonda = Math.floor(partidosAnt / 2);
    rondas.push({
      nombre: listaRondas[r],
      partidos: Array.from({ length: partidosRonda }, (_, i) => ({
        id: `r${r}p${i}`,
        equipoA: null,
        equipoB: null,
        setsA: null,
        setsB: null,
        ganador: null,
      }))
    });
    partidosAnt = partidosRonda;
  }

  return {
    formato: 'eliminacion',
    equipos: clasificados,
    rondas,
    campeon: null,
    createdAt: new Date().toISOString(),
  };
}

function generarBracketLiguilla(clasificados) {
  const partidos = [];
  for (let i = 0; i < clasificados.length; i++) {
    for (let j = i + 1; j < clasificados.length; j++) {
      partidos.push({
        id: `lg${i}x${j}`,
        equipoA: clasificados[i],
        equipoB: clasificados[j],
        setsA: null,
        setsB: null,
        ganador: null,
      });
    }
  }
  return {
    formato: 'liguilla',
    equipos: clasificados,
    partidos,
    campeon: null,
    createdAt: new Date().toISOString(),
  };
}

function renderBracket(el, bracket, playoffsCfg) {
  const cfg      = LIGA.config || {};
  const usarSets = cfg.usarSets !== false;

  if (bracket.formato === 'liguilla') {
    renderBracketLiguilla(el, bracket, usarSets);
    return;
  }

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem;margin-bottom:1rem">
      <h2>🏆 <span>Playoffs</span></h2>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
        ${bracket.campeon ? `<div class="badge win" style="font-size:.95rem;padding:.4rem .9rem">🥇 Campeón: ${esc(bracket.campeon)}</div>` : ''}
        <button class="btn secondary small" id="btn-reset-bracket">🗑 Reiniciar</button>
      </div>
    </div>

    <div class="bracket-wrap">
      ${bracket.rondas.map((ronda, ri) => `
        <div class="bracket-ronda">
          <div class="bracket-ronda-nombre">${esc(ronda.nombre)}</div>
          <div class="bracket-partidos">
            ${ronda.partidos.map((p, pi) => `
              <div class="bracket-partido ${p.ganador ? 'bracket-partido-jugado' : ''}" id="bpart-${p.id}">
                <div class="bracket-equipo ${p.ganador === 'A' ? 'bracket-ganador' : ''}">
                  <span class="bracket-equipo-nom">${p.equipoA ? esc(p.equipoA) : '<span class="muted">Por definir</span>'}</span>
                  ${p.setsA !== null ? `<span class="bracket-sets">${p.setsA}</span>` : ''}
                </div>
                <div class="bracket-vs">vs</div>
                <div class="bracket-equipo ${p.ganador === 'B' ? 'bracket-ganador' : ''}">
                  <span class="bracket-equipo-nom">${p.equipoB && p.equipoB !== 'BYE' ? esc(p.equipoB) : p.equipoB === 'BYE' ? '<em class="muted">BYE</em>' : '<span class="muted">Por definir</span>'}</span>
                  ${p.setsB !== null ? `<span class="bracket-sets">${p.setsB}</span>` : ''}
                </div>
                ${p.equipoA && p.equipoB && p.equipoB !== 'BYE' && !p.ganador ? `
                  <button class="btn secondary small bracket-btn-resultado"
                    onclick="abrirResultadoBracket('${p.id}',${ri},${pi})">
                    + Resultado
                  </button>` : ''}
                ${p.ganador && p.equipoB !== 'BYE' ? `
                  <button class="btn secondary small bracket-btn-editar"
                    onclick="abrirResultadoBracket('${p.id}',${ri},${pi})">
                    ✏ Editar
                  </button>` : ''}
              </div>`).join('')}
          </div>
        </div>`).join('')}
    </div>

    <div id="bracket-modal" class="bracket-modal" style="display:none"></div>`;

  el.querySelector('#btn-reset-bracket').onclick = async () => {
    if (!confirmar('¿Reiniciar el bracket? Se perderán todos los resultados de playoffs.')) return;
    await guardarPlayoffs(LIGA.id, null);
    toast('Bracket eliminado');
    renderTab('playoffs');
  };

  window.abrirResultadoBracket = (id, ri, pi) => {
    const ronda = bracket.rondas[ri];
    const p     = ronda.partidos[pi];
    const modal = document.getElementById('bracket-modal');
    if (!modal) return;

    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="bracket-modal-card">
        <h3 style="margin-bottom:1rem">${esc(ronda.nombre)}</h3>
        <div class="bracket-modal-equipos">
          <div class="bracket-modal-equipo">${esc(p.equipoA)}</div>
          <div class="bracket-modal-sep">vs</div>
          <div class="bracket-modal-equipo">${esc(p.equipoB)}</div>
        </div>
        ${usarSets ? `
        <div class="form-row" style="margin-top:1rem;justify-content:center">
          <div class="form-group" style="align-items:center">
            <label>${esc(p.equipoA)}</label>
            <input type="number" id="bm-setsA" min="0" max="9" value="${p.setsA ?? ''}" style="max-width:70px;text-align:center;font-size:1.3rem;font-weight:800">
          </div>
          <div style="align-self:flex-end;padding:.5rem;font-size:1.2rem;color:var(--muted)">—</div>
          <div class="form-group" style="align-items:center">
            <label>${esc(p.equipoB)}</label>
            <input type="number" id="bm-setsB" min="0" max="9" value="${p.setsB ?? ''}" style="max-width:70px;text-align:center;font-size:1.3rem;font-weight:800">
          </div>
        </div>` : `
        <div style="margin-top:1rem">
          <label style="display:block;margin-bottom:.5rem;color:var(--muted);font-size:.85rem">Ganador</label>
          <div style="display:flex;gap:.6rem">
            <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
              <input type="radio" name="bm-ganador" value="A" ${p.ganador==='A'?'checked':''}> ${esc(p.equipoA)}
            </label>
            <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
              <input type="radio" name="bm-ganador" value="B" ${p.ganador==='B'?'checked':''}> ${esc(p.equipoB)}
            </label>
          </div>
        </div>`}
        <div id="bm-error" class="auth-error" style="display:none;margin-top:.6rem"></div>
        <div class="flex mt1">
          <button class="btn" id="btn-bm-guardar">✓ Guardar</button>
          <button class="btn secondary" id="btn-bm-cerrar">Cancelar</button>
        </div>
      </div>`;

    document.getElementById('btn-bm-cerrar').onclick = () => { modal.style.display = 'none'; };
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

    document.getElementById('btn-bm-guardar').onclick = async () => {
      const errEl = document.getElementById('bm-error');
      errEl.style.display = 'none';
      let sA, sB, ganador;

      if (usarSets) {
        sA = parseInt(document.getElementById('bm-setsA').value);
        sB = parseInt(document.getElementById('bm-setsB').value);
        if (isNaN(sA) || isNaN(sB)) { errEl.textContent = 'Ingresa los sets'; errEl.style.display = 'block'; return; }
        if (sA === sB) { errEl.textContent = 'Debe haber un ganador'; errEl.style.display = 'block'; return; }
        ganador = sA > sB ? 'A' : 'B';
      } else {
        const rad = document.querySelector('input[name="bm-ganador"]:checked');
        if (!rad) { errEl.textContent = 'Selecciona el ganador'; errEl.style.display = 'block'; return; }
        ganador = rad.value; sA = ganador === 'A' ? 1 : 0; sB = ganador === 'B' ? 1 : 0;
      }

      bracket.rondas[ri].partidos[pi] = { ...p, setsA: sA, setsB: sB, ganador };

      const ganadorNombre = ganador === 'A' ? p.equipoA : p.equipoB;
      const siguienteRonda = bracket.rondas[ri + 1];
      if (siguienteRonda) {
        const posEnSiguiente  = Math.floor(pi / 2);
        const ladoEnSiguiente = pi % 2 === 0 ? 'equipoA' : 'equipoB';
        siguienteRonda.partidos[posEnSiguiente][ladoEnSiguiente] = ganadorNombre;
      } else {
        bracket.campeon = ganadorNombre;
      }

      await guardarPlayoffs(LIGA.id, bracket);
      modal.style.display = 'none';
      toast(`✓ ${ganadorNombre} avanza`);
      renderTab('playoffs');
    };
  };
}

function renderBracketLiguilla(el, bracket, usarSets) {
  const tablaLig = {};
  bracket.equipos.forEach(e => { tablaLig[e] = { equipo: e, pj: 0, pg: 0, pp: 0, pts: 0 }; });
  bracket.partidos.filter(p => p.ganador).forEach(p => {
    const a = tablaLig[p.equipoA], b = tablaLig[p.equipoB];
    if (!a || !b) return;
    a.pj++; b.pj++;
    if (p.ganador === 'A') { a.pg++; b.pp++; a.pts += 2; }
    else { b.pg++; a.pp++; b.pts += 2; }
  });
  const tablaOrdenada = Object.values(tablaLig).sort((a, b) => b.pts - a.pts || b.pg - a.pg);

  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.6rem;margin-bottom:1rem">
      <h2>🏆 <span>Liguilla</span></h2>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center">
        ${bracket.campeon ? `<div class="badge win" style="font-size:.95rem;padding:.4rem .9rem">🥇 ${esc(bracket.campeon)}</div>` : ''}
        <button class="btn secondary small" id="btn-reset-bracket">🗑 Reiniciar</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:1rem">
      <p class="card-subtitle">Tabla de Liguilla</p>
      <div class="tabla-wrap">
        <table class="tabla-pos">
          <thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>PTS</th></tr></thead>
          <tbody>
            ${tablaOrdenada.map((r, i) => `
              <tr ${i === 0 ? 'class="top-row"' : ''}>
                <td>${i === 0 ? '🥇' : i + 1}</td>
                <td>${esc(r.equipo)}</td>
                <td>${r.pj}</td>
                <td class="green">${r.pg}</td>
                <td class="red">${r.pp}</td>
                <td class="pts-cell">${r.pts}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <div class="card">
      <p class="card-subtitle">Partidos de Liguilla</p>
      <div class="fixture-list">
        ${bracket.partidos.map(p => `
          <div class="fixture-item ${p.ganador ? 'jugado' : ''}">
            <div class="fixture-teams">
              <span class="${p.ganador === 'A' ? 'team-win' : ''}">${esc(p.equipoA)}</span>
              <span class="fixture-vs">${p.ganador ? `${p.setsA}:${p.setsB}` : 'vs'}</span>
              <span class="${p.ganador === 'B' ? 'team-win' : ''}">${esc(p.equipoB)}</span>
            </div>
            ${p.ganador
              ? `<span class="badge win">🏆 ${esc(p.ganador === 'A' ? p.equipoA : p.equipoB)}</span>
                 <button class="btn secondary small" onclick="abrirResultadoLiguilla('${p.id}')">✏ Editar</button>`
              : `<button class="btn secondary small" onclick="abrirResultadoLiguilla('${p.id}')">+ Resultado</button>`}
          </div>`).join('')}
      </div>
    </div>

    <div id="bracket-modal" class="bracket-modal" style="display:none"></div>`;

  el.querySelector('#btn-reset-bracket').onclick = async () => {
    if (!confirmar('¿Reiniciar la liguilla?')) return;
    await guardarPlayoffs(LIGA.id, null);
    toast('Liguilla eliminada');
    renderTab('playoffs');
  };

  window.abrirResultadoLiguilla = id => {
    const p     = bracket.partidos.find(x => x.id === id);
    if (!p) return;
    const modal = document.getElementById('bracket-modal');
    modal.style.display = 'flex';
    modal.innerHTML = `
      <div class="bracket-modal-card">
        <h3 style="margin-bottom:1rem">Resultado de Liguilla</h3>
        <div class="bracket-modal-equipos">
          <div class="bracket-modal-equipo">${esc(p.equipoA)}</div>
          <div class="bracket-modal-sep">vs</div>
          <div class="bracket-modal-equipo">${esc(p.equipoB)}</div>
        </div>
        ${usarSets ? `
        <div class="form-row" style="margin-top:1rem;justify-content:center">
          <div class="form-group" style="align-items:center">
            <label>${esc(p.equipoA)}</label>
            <input type="number" id="bm-setsA" min="0" max="9" value="${p.setsA ?? ''}" style="max-width:70px;text-align:center;font-size:1.3rem;font-weight:800">
          </div>
          <div style="align-self:flex-end;padding:.5rem;color:var(--muted)">—</div>
          <div class="form-group" style="align-items:center">
            <label>${esc(p.equipoB)}</label>
            <input type="number" id="bm-setsB" min="0" max="999" value="${p.setsB ?? ''}" style="max-width:70px;text-align:center;font-size:1.3rem;font-weight:800">
          </div>
        </div>` : `
        <div style="margin-top:1rem">
          <label style="display:block;margin-bottom:.5rem;color:var(--muted);font-size:.85rem">Ganador</label>
          <div style="display:flex;gap:.6rem">
            <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
              <input type="radio" name="bm-ganador" value="A" ${p.ganador==='A'?'checked':''}> ${esc(p.equipoA)}
            </label>
            <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer">
              <input type="radio" name="bm-ganador" value="B" ${p.ganador==='B'?'checked':''}> ${esc(p.equipoB)}
            </label>
          </div>
        </div>`}
        <div id="bm-error" class="auth-error" style="display:none;margin-top:.6rem"></div>
        <div class="flex mt1">
          <button class="btn" id="btn-bm-guardar">✓ Guardar</button>
          <button class="btn secondary" id="btn-bm-cerrar">Cancelar</button>
        </div>
      </div>`;

    document.getElementById('btn-bm-cerrar').onclick = () => { modal.style.display = 'none'; };
    modal.onclick = e => { if (e.target === modal) modal.style.display = 'none'; };

    document.getElementById('btn-bm-guardar').onclick = async () => {
      const errEl = document.getElementById('bm-error');
      let sA, sB, ganador;
      if (usarSets) {
        sA = parseInt(document.getElementById('bm-setsA').value);
        sB = parseInt(document.getElementById('bm-setsB').value);
        if (isNaN(sA) || isNaN(sB)) { errEl.textContent = 'Ingresa los sets'; errEl.style.display = 'block'; return; }
        if (sA === sB) { errEl.textContent = 'Debe haber un ganador'; errEl.style.display = 'block'; return; }
        ganador = sA > sB ? 'A' : 'B';
      } else {
        const rad = document.querySelector('input[name="bm-ganador"]:checked');
        if (!rad) { errEl.textContent = 'Selecciona el ganador'; errEl.style.display = 'block'; return; }
        ganador = rad.value; sA = ganador === 'A' ? 1 : 0; sB = ganador === 'B' ? 1 : 0;
      }

      const idx = bracket.partidos.findIndex(x => x.id === id);
      bracket.partidos[idx] = { ...p, setsA: sA, setsB: sB, ganador };

      // Calcular campeón si todos los partidos están jugados
      const tb = {};
      bracket.equipos.forEach(e => { tb[e] = { pts: 0 }; });
      bracket.partidos.filter(x => x.ganador).forEach(x => {
        if (x.ganador === 'A') tb[x.equipoA].pts += 2;
        else tb[x.equipoB].pts += 2;
      });
      const pendientes = bracket.partidos.filter(x => !x.ganador).length;
      if (pendientes === 0) {
        bracket.campeon = Object.entries(tb).sort((a, b) => b[1].pts - a[1].pts)[0][0];
      }

      await guardarPlayoffs(LIGA.id, bracket);
      modal.style.display = 'none';
      toast('Resultado guardado ✓');
      renderTab('playoffs');
    };
  };
}

// ── Finanzas ─────────────────────────────────────────────────
function renderFinanzas(el) {
  const cfg      = LIGA.config || {};
  const precioI  = cfg.precioInscripcion ?? 500;
  const precioA  = cfg.precioArbitraje   ?? 120;
  const permitirAdelanto = cfg.permitirAdelantoArb !== false;
  const norm     = partidos.filter(p=>!p.es_playoff&&p.jugado);
  const inscPag  = equipos.filter(e=>e.inscripcion_pagada).length;
  const inscPend = equipos.length - inscPag;
  const arbCob   = norm.reduce((s,p)=>s+(p.pago_arb_a?precioA:0)+(p.pago_arb_b?precioA:0),0);
  const arbPend  = norm.reduce((s,p)=>s+(!p.pago_arb_a?precioA:0)+(!p.pago_arb_b?precioA:0),0);
  const vueltas  = cfg.vueltas || 2;
  const noms     = equipos.map(e => e.nombre);
  const fixture  = generarFixture(noms);

  const htmlAdelanto = equipos.map((eq, idx) => {
    const n   = eq.nombre;
    const sid = `eq_${idx}`;
    const jugPend = norm.filter(p=>
      (p.equipo_a===n&&!p.pago_arb_a)||(p.equipo_b===n&&!p.pago_arb_b)
    ).length;
    let futuros = 0;
    for (let v=1; v<=vueltas; v++) {
      fixture.forEach(enc => {
        const eA = v===1 ? enc.local : enc.visitante;
        const eB = v===1 ? enc.visitante : enc.local;
        const ya = partidos.find(p => !p.es_playoff && p.vuelta===v &&
          ((p.equipo_a===eA&&p.equipo_b===eB)||(p.equipo_a===eB&&p.equipo_b===eA)));
        if (!ya && (eA===n||eB===n)) futuros++;
      });
    }
    const saldo      = eq.arb_saldo || 0;
    const montoBruto = (jugPend + futuros) * precioA;
    const montoNeto  = Math.max(0, montoBruto - saldo);

    return `
      <div class="arb-equipo-row">
        <div class="arb-equipo-nom">${esc(n)}</div>
        <div class="arb-equipo-detalle">
          ${jugPend>0 ? `<span class="muted" style="font-size:.8rem">⚠ ${jugPend} jugado${jugPend!==1?'s':''} pendiente${jugPend!==1?'s':''} ($${(jugPend*precioA).toLocaleString('es-MX')})</span>` : ''}
          ${futuros>0 ? `<span class="muted" style="font-size:.8rem">📅 ${futuros} futuro${futuros!==1?'s':''} ($${(futuros*precioA).toLocaleString('es-MX')})</span>` : ''}
          ${saldo>0   ? `<span style="color:#10b981;font-size:.8rem">✓ Saldo a favor: $${saldo.toLocaleString('es-MX')}</span>` : ''}
          ${montoNeto===0 && jugPend===0
            ? '<span class="badge win">✓ Al corriente</span>'
            : `<strong>Pendiente neto: $${montoNeto.toLocaleString('es-MX')}</strong>`}
        </div>
        <div class="arb-equipo-acciones">
          <button class="btn secondary" style="font-size:.8rem"
            onclick="abrirPagoEquipo('${sid}')">💸 Registrar pago</button>
        </div>
        <div id="arb-form-${sid}" style="display:none;width:100%;margin-top:.5rem" class="arb-equipo-form">
          <input type="number" id="arb-monto-${sid}"
            value="${montoNeto > 0 ? montoNeto : precioA}" min="1"
            style="width:110px;padding:.3rem .5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text)">
          <button class="btn" style="font-size:.8rem"
            onclick="confirmarPagoEquipoLiga('${esc(n)}','${sid}',${jugPend},${precioA})">✓ Confirmar</button>
          <button class="btn secondary" style="font-size:.8rem"
            onclick="abrirPagoEquipo('${sid}')">Cancelar</button>
          <p class="muted" style="font-size:.74rem;margin-top:.3rem">
            Puedes pagar cualquier monto — el sobrante queda como saldo a favor para futuros partidos.
          </p>
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <h2>💰 <span>Finanzas</span></h2>

    <div class="resumen-financiero">
      <div class="resumen-fin-grid">
        <div class="resumen-fin-card total">
          <div class="resumen-fin-val">$${((inscPag*precioI)+arbCob).toLocaleString('es-MX')}</div>
          <div class="resumen-fin-lbl">Total cobrado</div>
        </div>
        <div class="resumen-fin-card insc">
          <div class="resumen-fin-val">$${(inscPag*precioI).toLocaleString('es-MX')}</div>
          <div class="resumen-fin-lbl">Inscripciones ${inscPag}/${equipos.length}</div>
          ${inscPend>0
            ? `<div class="resumen-fin-pend">Pendiente $${(inscPend*precioI).toLocaleString('es-MX')}</div>`
            : '<div class="resumen-fin-ok">✓</div>'}
        </div>
        <div class="resumen-fin-card arb">
          <div class="resumen-fin-val">$${arbCob.toLocaleString('es-MX')}</div>
          <div class="resumen-fin-lbl">Arbitrajes cobrados</div>
          ${arbPend>0
            ? `<div class="resumen-fin-pend">Pendiente $${arbPend.toLocaleString('es-MX')}</div>`
            : '<div class="resumen-fin-ok">✓ Al corriente</div>'}
        </div>
      </div>
    </div>

    <div class="card" style="margin-top:1.2rem">
      <p class="card-subtitle">📋 Inscripciones</p>
      ${equipos.map(e=>`
        <div class="arb-pill ${e.inscripcion_pagada?'pagado':'pendiente'}" style="margin-bottom:.5rem">
          <span class="arb-pill-nom">${esc(e.nombre)}</span>
          <small class="muted">$${precioI.toLocaleString('es-MX')}</small>
          ${e.inscripcion_pagada
            ? '<span class="arb-pill-estado">✓ Pagado</span>'
            : `<button class="arb-pill-btn" onclick="pagarInscripcionLiga('${e.id}')">Marcar pagado</button>`}
        </div>`).join('')}
    </div>

    ${permitirAdelanto ? `
    <div class="card" style="margin-top:1.2rem">
      <p class="card-subtitle">💸 Arbitrajes por equipo</p>
      <p class="muted" style="font-size:.8rem;margin-bottom:1rem">
        Puedes registrar cualquier monto — parcial o completo. El sobrante se guarda como saldo a favor.
      </p>
      ${htmlAdelanto}
    </div>` : ''}

    <div class="card" style="margin-top:1.2rem">
      <p class="card-subtitle">Detalle por partido</p>
      ${!norm.length ? '<p class="muted">Sin partidos jugados aún.</p>' :
        norm.sort((a,b)=>a.vuelta-b.vuelta).map(p=>`
          <div class="fixture-item" style="flex-direction:column;align-items:flex-start;gap:.4rem">
            <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
              <span class="badge ${p.vuelta===1?'pending':'done'}">V${p.vuelta}</span>
              <span><strong>${esc(p.equipo_a)}</strong> vs <strong>${esc(p.equipo_b)}</strong></span>
              ${p.fecha?`<span class="fixture-date">${formatFecha(p.fecha)}</span>`:''}
            </div>
            <div class="arb-row" style="width:100%">
              <div class="arb-pill ${p.pago_arb_a?'pagado':'pendiente'}">
                <span class="arb-pill-nom">${esc(p.equipo_a)}</span>
                ${p.pago_arb_a
                  ? '<span class="arb-pill-estado">✓ Pagado</span>'
                  : `<button class="arb-pill-btn" onclick="pagarArbPartido('${p.id}','pago_arb_a')">Pagar $${precioA}</button>`}
              </div>
              <div class="arb-pill ${p.pago_arb_b?'pagado':'pendiente'}">
                <span class="arb-pill-nom">${esc(p.equipo_b)}</span>
                ${p.pago_arb_b
                  ? '<span class="arb-pill-estado">✓ Pagado</span>'
                  : `<button class="arb-pill-btn" onclick="pagarArbPartido('${p.id}','pago_arb_b')">Pagar $${precioA}</button>`}
              </div>
            </div>
          </div>`).join('')}
    </div>`;

  window.pagarInscripcionLiga = async id => {
    if (!confirmar('¿Confirmar pago de inscripción?')) return;
    await actualizarEquipo(id, { inscripcion_pagada: true });
    renderTab('finanzas');
    toast('Inscripción registrada ✓');
  };

  window.pagarArbPartido = async (id, campo) => {
    await actualizarPartido(id, { [campo]: true });
    renderTab('finanzas');
    toast('Arbitraje registrado ✓');
  };

  window.abrirPagoEquipo = sid => {
    const form = document.getElementById(`arb-form-${sid}`);
    if (!form) return;
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
    form.style.flexWrap = 'wrap';
    form.style.gap = '.5rem';
    form.style.alignItems = 'center';
  };

  window.confirmarPagoEquipoLiga = async (nombre, sid, jugPend, precioA) => {
    const inp   = document.getElementById(`arb-monto-${sid}`);
    const monto = parseInt(inp?.value);
    if (!monto || monto < 1) { toast('Ingresa un monto válido', 'error'); return; }
    const eq = equipos.find(e => e.nombre === nombre);
    if (!eq) { toast('Equipo no encontrado', 'error'); return; }

    let resto = (eq.arb_saldo || 0) + monto;

    const pendientes = partidos.filter(p =>
      !p.es_playoff && p.jugado &&
      ((p.equipo_a===nombre&&!p.pago_arb_a)||(p.equipo_b===nombre&&!p.pago_arb_b))
    ).sort((a,b) => (a.fecha||'').localeCompare(b.fecha||''));

    for (const p of pendientes) {
      if (resto < precioA) break;
      const campo = p.equipo_a===nombre ? 'pago_arb_a' : 'pago_arb_b';
      await actualizarPartido(p.id, { [campo]: true });
      resto -= precioA;
    }

    await actualizarEquipo(eq.id, { arb_saldo: resto });
    toast(`✓ $${monto.toLocaleString('es-MX')} registrado${resto > 0 ? ` — Saldo a favor: $${resto.toLocaleString('es-MX')}` : ''}`);
    renderTab('finanzas');
  };
}

// ── Config ───────────────────────────────────────────────────
function renderConfigTab(el) {
  const cfg = {
    nombre:'', temporada:'', vueltas:2, usarPuntos:true, usarSets:true,
    ptsVictoria:2, ptsBono:1, ptsDerota:0, precioInscripcion:500, precioArbitraje:120,
    colorAcento:'#f59e0b', permitirAdelantoArb:true,
    ...(LIGA.config||{})
  };

  el.innerHTML = `
    <h2>⚙ <span>Configuración</span></h2>
    <div class="card">
      <p class="card-subtitle">🏷 Liga</p>
      <form id="form-cfg-liga">
        <div class="form-row">
          <div class="form-group" style="flex:3">
            <label>Nombre</label>
            <input type="text" id="cfg-nom" value="${esc(cfg.nombre)}" maxlength="60" required>
          </div>
          <div class="form-group" style="flex:2">
            <label>Temporada</label>
            <input type="text" id="cfg-temp" value="${esc(cfg.temporada)}" maxlength="20">
          </div>
          <div class="form-group">
            <label>Vueltas</label>
            <select id="cfg-vueltas">
              <option value="1" ${cfg.vueltas===1?'selected':''}>1</option>
              <option value="2" ${cfg.vueltas===2?'selected':''}>2</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Precio inscripción ($)</label>
            <input type="number" id="cfg-pinsc" value="${cfg.precioInscripcion}" min="0" style="max-width:100px">
          </div>
          <div class="form-group">
            <label>Precio arbitraje ($)</label>
            <input type="number" id="cfg-parb" value="${cfg.precioArbitraje}" min="0" style="max-width:100px">
          </div>
        </div>
        <label class="check-row cfg-toggle-row">
          <input type="checkbox" id="cfg-adelanto" ${cfg.permitirAdelantoArb!==false?'checked':''}>
          <span>
            <strong>Permitir adelanto de arbitrajes</strong>
            <small>Muestra el panel de pago por equipo en Finanzas.</small>
          </span>
        </label>
        <div class="flex mt1"><button type="submit" class="btn">💾 Guardar</button></div>
      </form>
    </div>
    <div class="card">
      <p class="card-subtitle">🏐 Formato del partido</p>
      <label class="check-row cfg-toggle-row">
        <input type="checkbox" id="cfg-sets" ${cfg.usarSets?'checked':''}>
        <span><strong>Registrar sets</strong><small>Desactiva para solo registrar ganador/perdedor.</small></span>
      </label>
      <label class="check-row cfg-toggle-row">
        <input type="checkbox" id="cfg-pts" ${cfg.usarPuntos?'checked':''}>
        <span><strong>Columna de puntos (PTS)</strong></span>
      </label>
      <div class="form-row" style="margin-top:.8rem">
        <div class="form-group"><label>Pts. victoria</label><input type="number" id="cfg-ptsV" value="${cfg.ptsVictoria}" min="0" style="max-width:80px"></div>
        <div class="form-group"><label>Bono derrota</label><input type="number" id="cfg-ptsB" value="${cfg.ptsBono}" min="0" style="max-width:80px"></div>
        <div class="form-group"><label>Pts. derrota</label><input type="number" id="cfg-ptsD" value="${cfg.ptsDerota}" min="0" style="max-width:80px"></div>
      </div>
      <div class="flex mt1"><button class="btn" id="btn-guardar-formato">💾 Guardar formato</button></div>
    </div>
    <div class="card">
      <p class="card-subtitle">🔗 Acceso público</p>
      <p class="muted" style="font-size:.85rem;margin-bottom:1rem">
        Comparte el link para que cualquiera vea tu liga sin iniciar sesión.
      </p>
      <div style="margin-bottom:1.2rem">
        <label style="font-size:.82rem;color:var(--muted);font-weight:600;display:block;margin-bottom:.4rem">
          Nombre corto personalizado
        </label>
        <div style="display:flex;gap:.6rem;flex-wrap:wrap;align-items:center">
          <input type="text" id="input-alias"
            value="${esc(LIGA.alias||'')}"
            placeholder="ej: lachona"
            maxlength="20"
            style="max-width:200px;font-size:.95rem;letter-spacing:.05rem"
            oninput="this.value=this.value.toLowerCase().replace(/[^a-z0-9-]/g,'')">
          <button class="btn" id="btn-guardar-alias">Guardar alias</button>
        </div>
        <p class="muted" style="font-size:.75rem;margin-top:.4rem">
          Solo letras minúsculas, números y guiones. Mínimo 3 caracteres.<br>
          ${LIGA.alias
            ? `Link actual: <code style="color:var(--accent)">${location.origin}/?liga=${LIGA.alias}</code>`
            : 'Sin alias aún — se accede por código aleatorio.'}
        </p>
        <div id="alias-error" class="auth-error" style="display:none;margin-top:.4rem"></div>
        <div id="alias-ok" style="display:none;color:var(--green);font-size:.82rem;margin-top:.4rem"></div>
      </div>
      <div style="border-top:1px solid var(--border);padding-top:1rem">
        <label style="font-size:.82rem;color:var(--muted);font-weight:600;display:block;margin-bottom:.6rem">
          Código de respaldo (siempre funciona)
        </label>
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
          <code class="codigo-chip" style="font-size:1.3rem;padding:.4rem 1rem">${LIGA.codigo}</code>
          <button class="btn secondary" id="btn-renovar-codigo">🔄 Renovar</button>
          <button class="btn secondary" id="btn-copiar-link">📋 Copiar link</button>
        </div>
      </div>
    </div>
    <div class="card">
      <p class="card-subtitle">👥 Co-administradores</p>
      <div id="lista-coadmins"></div>
      <div class="form-row" style="margin-top:1rem">
        <input type="email" id="invite-email" placeholder="correo@ejemplo.com" style="flex:1">
        <button class="btn" id="btn-invitar">Invitar</button>
      </div>
    </div>`;

  cargarCoAdmins(el.querySelector('#lista-coadmins'));

  el.querySelector('#form-cfg-liga').onsubmit = async e => {
    e.preventDefault();
    const nuevoCfg = { ...cfg,
      nombre:             el.querySelector('#cfg-nom').value.trim(),
      temporada:          el.querySelector('#cfg-temp').value.trim(),
      vueltas:            parseInt(el.querySelector('#cfg-vueltas').value),
      precioInscripcion:  parseInt(el.querySelector('#cfg-pinsc').value)||500,
      precioArbitraje:    parseInt(el.querySelector('#cfg-parb').value)||120,
      permitirAdelantoArb: el.querySelector('#cfg-adelanto').checked,
    };
    await actualizarLiga(LIGA.id, { nombre: nuevoCfg.nombre, temporada: nuevoCfg.temporada, config: nuevoCfg });
    LIGA.config = nuevoCfg; LIGA.nombre = nuevoCfg.nombre;
    const t = document.querySelector('#topbar-liga-nombre');
    if (t) t.textContent = nuevoCfg.nombre;
    toast('Configuración guardada ✓');
  };

  el.querySelector('#btn-guardar-formato').onclick = async () => {
    const nuevoCfg = { ...cfg,
      usarSets:    el.querySelector('#cfg-sets').checked,
      usarPuntos:  el.querySelector('#cfg-pts').checked,
      ptsVictoria: parseInt(el.querySelector('#cfg-ptsV').value)||2,
      ptsBono:     parseInt(el.querySelector('#cfg-ptsB').value)||0,
      ptsDerota:   parseInt(el.querySelector('#cfg-ptsD').value)||0,
    };
    await actualizarLiga(LIGA.id, { config: nuevoCfg });
    LIGA.config = nuevoCfg;
    toast('Formato guardado ✓');
  };

  el.querySelector('#btn-guardar-alias').onclick = async () => {
    const aliasInp = el.querySelector('#input-alias');
    const aliasErr = el.querySelector('#alias-error');
    const aliasOk  = el.querySelector('#alias-ok');
    aliasErr.style.display = 'none';
    aliasOk.style.display  = 'none';
    const val = aliasInp.value.trim();
    try {
      if (!val) {
        await actualizarLiga(LIGA.id, { alias: null });
        LIGA.alias = null;
        aliasOk.textContent = 'Alias eliminado.';
        aliasOk.style.display = 'block';
      } else {
        const { actualizarAlias } = await import('../lib/db.js');
        const limpio = await actualizarAlias(LIGA.id, val);
        LIGA.alias = limpio;
        aliasOk.textContent = `✓ Link: ${location.origin}/?liga=${limpio}`;
        aliasOk.style.display = 'block';
      }
      renderTab('config');
      toast('Alias guardado ✓');
    } catch(err) {
      aliasErr.textContent = err.message;
      aliasErr.style.display = 'block';
    }
  };

  el.querySelector('#btn-renovar-codigo').onclick = async () => {
    if (!confirmar('¿Renovar el código? El anterior dejará de funcionar.')) return;
    const nuevo = await renovarCodigo(LIGA.id);
    LIGA.codigo = nuevo;
    renderTab('config');
    toast('Código renovado ✓');
  };

  el.querySelector('#btn-copiar-link').onclick = () => {
    const link = `${location.origin}/?liga=${LIGA.alias || LIGA.codigo}`;
    navigator.clipboard?.writeText(link).then(()=>toast('Link copiado ✓')).catch(()=>toast(link));
  };

  el.querySelector('#btn-invitar').onclick = async () => {
    const email = el.querySelector('#invite-email').value.trim();
    if (!email) { toast('Escribe un correo', 'error'); return; }
    try {
      await invitarCoAdmin(LIGA.id, email);
      el.querySelector('#invite-email').value = '';
      cargarCoAdmins(el.querySelector('#lista-coadmins'));
      toast('Co-admin invitado ✓');
    } catch(err) { toast(err.message, 'error'); }
  };

  async function cargarCoAdmins(cont) {
    const miembros = await getMiembros(LIGA.id);
    cont.innerHTML = miembros.map(m => `
      <div class="fixture-item">
        <span style="flex:1">${esc(m.profiles?.nombre||m.profiles?.email||'—')}</span>
        <span class="badge ${m.role==='owner'?'win':'pending'}">${m.role==='owner'?'Propietario':'Co-admin'}</span>
        ${m.role!=='owner'?`<button class="btn danger small" onclick="quitarCoAdmin('${m.id}')">Quitar</button>`:''}
      </div>`).join('');
    window.quitarCoAdmin = async id => {
      if (!confirmar('¿Quitar este co-admin?')) return;
      const m = miembros.find(x=>x.id===id);
      if (m) await quitarMiembro(LIGA.id, m.user_id);
      cargarCoAdmins(cont);
      toast('Co-admin eliminado');
    };
  }
}

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════
const REGLAS_DEFAULT = [
  { nombre:'Set 1', puntos:25, diferencia:2, usarPuntosSet:true },
  { nombre:'Set 2', puntos:25, diferencia:2, usarPuntosSet:true },
  { nombre:'Set 3 (desempate)', puntos:15, diferencia:2, usarPuntosSet:true },
];

function generarFixture(noms) {
  const enc = [];
  for (let i=0; i<noms.length; i++)
    for (let j=i+1; j<noms.length; j++)
      enc.push({ local:noms[i], visitante:noms[j] });
  return enc;
}

function calcularTabla(equipos, partidos, cfg) {
  const usarPts  = cfg.usarPuntos !== false;
  const usarSets = cfg.usarSets   !== false;
  const ptsV = cfg.ptsVictoria ?? 2;
  const ptsB = cfg.ptsBono     ?? 1;
  const ptsD = cfg.ptsDerota   ?? 0;
  const t = {};
  equipos.forEach(e => { t[e.nombre] = {equipo:e.nombre,pj:0,pg:0,pp:0,sg:0,sp:0,pts:0}; });
  partidos.filter(p=>p.jugado&&!p.es_playoff).forEach(p => {
    const a=t[p.equipo_a], b=t[p.equipo_b];
    if (!a||!b) return;
    a.pj++; b.pj++;
    if (usarSets) { a.sg+=p.sets_a; a.sp+=p.sets_b; b.sg+=p.sets_b; b.sp+=p.sets_a; }
    if (p.ganador==='A') {
      a.pg++; b.pp++;
      if (usarPts) { a.pts+=ptsV; b.pts+=ptsD; if(usarSets&&p.sets_b>0) b.pts+=ptsB; }
    } else {
      b.pg++; a.pp++;
      if (usarPts) { b.pts+=ptsV; a.pts+=ptsD; if(usarSets&&p.sets_a>0) a.pts+=ptsB; }
    }
  });
  return Object.values(t).sort((a,b) => {
    if (usarPts&&b.pts!==a.pts) return b.pts-a.pts;
    if (b.pg!==a.pg) return b.pg-a.pg;
    if (usarSets) return (b.sg-b.sp)-(a.sg-a.sp);
    return 0;
  });
}

function buildSetsFormLiga(cont, reglas, usarSets) {
  if (!usarSets) {
    cont.innerHTML = `<div class="set-block">
      <h4>Resultado</h4>
      <label style="display:flex;align-items:center;gap:.5rem;margin-bottom:.4rem;cursor:pointer">
        <input type="radio" name="ganador-simple" value="A"> Equipo A gana
      </label>
      <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
        <input type="radio" name="ganador-simple" value="B"> Equipo B gana
      </label>
    </div>`;
    return;
  }
  cont.innerHTML = reglas.map((r,i) => {
    const idx=i+1, esD=i===reglas.length-1&&reglas.length>1;
    const conPts = r.usarPuntosSet!==false;
    return `<div class="set-block" id="bloque-set${idx}">
      <h4>${esc(r.nombre)}${esD?' <small style="color:var(--accent);font-size:.7rem">(Desempate)</small>':''}</h4>
      <div class="set-score">
        <input type="number" id="s${idx}a" min="0" max="999" placeholder="Eq A">
        <span>—</span>
        <input type="number" id="s${idx}b" min="0" max="999" placeholder="Eq B">
      </div>
      <p class="note">${conPts ? `Mín ${r.puntos} · Dif ≥ ${r.diferencia}` : 'Solo ganador'}</p>
    </div>`;
  }).join('');
}

function leerSets(el, reglas) {
  const sets=[]; let sA=0, sB=0;
  for (let i=0; i<reglas.length; i++) {
    const bloque = el.querySelector(`#bloque-set${i+1}`);
    if (!bloque || bloque.style.display==='none') break;
    const pA = parseInt(el.querySelector(`#s${i+1}a`).value);
    const pB = parseInt(el.querySelector(`#s${i+1}b`).value);
    if (isNaN(pA)||isNaN(pB)) return {ok:false, msg:`Completa el set ${i+1}`};
    const r = reglas[i] || reglas[reglas.length-1];
    if (r.usarPuntosSet!==false) {
      const max=Math.max(pA,pB), min=Math.min(pA,pB);
      if (max<r.puntos||(max-min)<r.diferencia) return {ok:false, msg:`Set ${i+1} inválido: ${pA}-${pB}`};
    } else {
      if (pA===pB) return {ok:false, msg:`Set ${i+1}: debe haber un ganador`};
    }
    sets.push({pA,pB});
    if (pA>pB) sA++; else sB++;
  }
  const setsParaGanar = Math.ceil(reglas.length/2);
  const ganador = sA>=setsParaGanar ? 'A' : sB>=setsParaGanar ? 'B' : null;
  if (!ganador) return {ok:false, msg:'No hay ganador aún. Agrega más sets.'};
  return {ok:true, sets, sA, sB, ganador};
}
