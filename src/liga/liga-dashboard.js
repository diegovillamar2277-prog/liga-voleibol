// ============================================================
//  liga-dashboard.js — Vista del organizador de su liga
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

// Obtener perfil actual de forma segura
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
    await abrirLiga(misLigas[0], container.querySelector('#org-main'));
  } else {
    renderSelectorLigas(misLigas, container.querySelector('#org-main'));
  }
}

// ── Sin ligas todavía ────────────────────────────────────────
function renderSinLigas(el) {
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🏐</div>
      <h2>No tienes ligas aún</h2>
      <p class="muted">Crea tu primera liga para empezar a gestionar equipos y partidos.</p>
      <button class="btn" id="btn-crear-primera">+ Crear mi primera liga</button>
    </div>`;
  el.querySelector('#btn-crear-primera').onclick = () => renderFormCrearLiga(el);
}

// ── Selector cuando hay varias ligas ────────────────────────
function renderSelectorLigas(ligas, el) {
  el.innerHTML = `
    <div class="ligas-selector">
      <h2>Mis ligas</h2>
      <div class="ligas-grid">
        ${ligas.map(l => `
          <div class="liga-card" data-id="${l.id}">
            <div class="liga-card-nombre">${esc(l.nombre)}</div>
            <div class="liga-card-temp muted">${esc(l.temporada||'')}</div>
            <div class="liga-card-codigo"><code>${l.codigo}</code></div>
            <span class="badge ${l.miRol==='owner'?'win':'pending'}">${l.miRol==='owner'?'Propietario':'Co-admin'}</span>
          </div>`).join('')}
        ${ligas.filter(l=>l.miRol==='owner').length < 2 ? `
          <div class="liga-card nueva" id="btn-nueva-liga">
            <div class="liga-card-nombre">+ Nueva liga</div>
          </div>` : ''}
      </div>
    </div>`;

  el.querySelectorAll('.liga-card[data-id]').forEach(card => {
    card.onclick = async () => {
      const liga = ligas.find(l => l.id === card.dataset.id);
      await abrirLiga(liga, el);
    };
  });

  const btnNueva = el.querySelector('#btn-nueva-liga');
  if (btnNueva) btnNueva.onclick = () => renderFormCrearLiga(el);
}

// ── Formulario crear liga ────────────────────────────────────
async function renderFormCrearLiga(el) {
  const perfil = await getPerfil();
  if (!perfil) { toast('Error de sesión, recarga','error'); return; }

  const total = await contarLigasDeUsuario(perfil.id);
  if (total >= 2) {
    el.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <h2>Límite de 2 ligas alcanzado</h2>
        <p class="muted">Para crear más ligas necesitas enviar una petición al administrador.</p>
        <form id="form-peticion" style="max-width:400px;margin:1.5rem auto 0">
          <textarea id="pet-mensaje" rows="3" style="width:100%;padding:.6rem;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text)"
            placeholder="Explica brevemente por qué necesitas más ligas…"></textarea>
          <div id="pet-error" class="auth-error" style="display:none"></div>
          <button type="submit" class="btn" style="margin-top:.6rem">Enviar petición</button>
        </form>
      </div>`;
    el.querySelector('#form-peticion').onsubmit = async e => {
      e.preventDefault();
      const msg = el.querySelector('#pet-mensaje').value.trim();
      if (!msg) { toast('Escribe un mensaje','error'); return; }
      try {
        await enviarPeticion(perfil.id, msg);
        toast('Petición enviada ✓');
        renderOrgPanel(document.querySelector('#app'));
      } catch(err) { toast(err.message,'error'); }
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
      const liga = await crearLiga({
        nombre, temporada: temp,
        ownerId: p.id,
        config: {}, reglas: [], playoffsCfg: {}
      });
      toast('Liga creada ✓');
      await abrirLiga(liga, el);
    } catch(err) {
      errEl.textContent = err.message;
      errEl.style.display = 'block';
    }
  };
}

// ════════════════════════════════════════════════════════════
//  VISTA PRINCIPAL DE LA LIGA (tabs)
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

  const getContent = () => document.querySelector('#liga-content');

  el.querySelectorAll('#liga-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('#liga-nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderTab(btn.dataset.tab, getContent());
    });
  });

  renderTab('tabla', getContent());
}

async function renderTab(tab, el) {
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
    if (!eA || !eB) { toast('Selecciona ambos equipos','error'); return; }
    if (eA === eB)  { toast('Los equipos deben ser diferentes','error'); return; }
    if (!fecha)     { toast('La fecha es obligatoria','error'); return; }

    let sets=[], sA=0, sB=0, ganador=null;
    if (!usarSets) {
      const rad = el.querySelector('input[name="ganador-simple"]:checked');
      if (!rad) { toast('Selecciona quién ganó','error'); return; }
      ganador = rad.value; sA = ganador==='A'?1:0; sB = ganador==='B'?1:0;
    } else {
      const res = leerSets(el, reglas);
      if (!res.ok) { toast(res.msg,'error'); return; }
      sets = res.sets; sA = res.sA; sB = res.sB; ganador = res.ganador;
    }

    const existe = partidos.some(p =>
      !p.es_playoff && p.vuelta===vuelta &&
      ((p.equipo_a===eA&&p.equipo_b===eB)||(p.equipo_a===eB&&p.equipo_b===eA))
    );
    if (existe) { toast('Ya existe este partido en esa vuelta','error'); return; }

    try {
      await guardarPartido(LIGA.id, {
        vuelta, fecha, equipo_a:eA, equipo_b:eB,
        sets, sets_a:sA, sets_b:sB, ganador, jugado:true,
        pago_arb_a:false, pago_arb_b:false
      });
      toast(`✓ ${eA} ${sA}:${sB} ${eB}`);
      e.target.reset();
      renderTab('partidos', el);
    } catch(err) { toast(err.message,'error'); }
  });

  window.eliminarPartidoLiga = async id => {
    if (!confirmar('¿Eliminar este partido?')) return;
    await eliminarPartido(id);
    renderTab('partidos', el);
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
    if (!nom) { toast('Escribe un nombre','error'); return; }
    if (equipos.some(e=>e.nombre.toLowerCase()===nom.toLowerCase())) { toast('Nombre duplicado','error'); return; }
    await agregarEquipo(LIGA.id, nom);
    inp.value = '';
    renderTab('equipos', el);
    toast('Equipo agregado ✓');
  };

  window.eliminarEquipoLiga = async id => {
    if (!confirmar('¿Eliminar este equipo?')) return;
    await eliminarEquipo(id);
    renderTab('equipos', el);
    toast('Equipo eliminado');
  };
}

// ── Playoffs ─────────────────────────────────────────────────
function renderPlayoffsTab(el) {
  el.innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">🏆</div>
      <h2>Playoffs</h2>
      <p class="muted">Disponible en la próxima actualización.</p>
    </div>`;
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

  // Calcular fixture completo para partidos futuros
  const vueltas  = cfg.vueltas || 2;
  const noms     = equipos.map(e => e.nombre);
  const fixture  = generarFixture(noms);

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
          ${inscPend>0?`<div class="resumen-fin-pend">Pendiente $${(inscPend*precioI).toLocaleString('es-MX')}</div>`:'<div class="resumen-fin-ok">✓</div>'}
        </div>
        <div class="resumen-fin-card arb">
          <div class="resumen-fin-val">$${arbCob.toLocaleString('es-MX')}</div>
          <div class="resumen-fin-lbl">Arbitrajes cobrados</div>
          ${arbPend>0?`<div class="resumen-fin-pend">Jugados pendientes $${arbPend.toLocaleString('es-MX')}</div>`:'<div class="resumen-fin-ok">✓ Jugados al corriente</div>'}
        </div>
      </div>
    </div>

    <!-- Inscripciones -->
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

    <!-- Adelanto por equipo -->
    ${permitirAdelanto ? `
    <div class="card" style="margin-top:1.2rem">
      <p class="card-subtitle">💸 Adelanto de arbitrajes por equipo</p>
      <p class="muted" style="font-size:.8rem;margin-bottom:1rem">
        Incluye partidos jugados pendientes y partidos futuros del fixture. Puedes pagar cualquier monto parcial.
      </p>
      <div id="panel-adelanto-equipos">
        ${equipos.map(eq => {
          const n = eq.nombre;
          const sid = 'eq_' + equipos.indexOf(eq);
          const jugPendA = norm.filter(p=>p.equipo_a===n&&!p.pago_arb_a).length;
          const jugPendB = norm.filter(p=>p.equipo_b===n&&!p.pago_arb_b).length;
          const totalJug = jugPendA + jugPendB;
          // Futuros
          let futuros = 0;
          for (let v=1;v<=vueltas;v++) {
            fixture.forEach(enc => {
              const eA = v===1?enc.local:enc.visitante;
              const eB = v===1?enc.visitante:enc.local;
              const yaJugado = partidos.find(p=>!p.es_playoff&&p.vuelta===v&&
                ((p.equipo_a===eA&&p.equipo_b===eB)||(p.equipo_a===eB&&p.equipo_b===eA)));
              if (!yaJugado&&(eA===n||eB===n)) futuros++;
            });
          }
          const saldo = eq.arb_saldo||0;
          const montoBruto = (totalJug+futuros)*precioA;
          const montoNeto  = Math.max(0, montoBruto - saldo);
          return `<div class="arb-equipo-row">
            <div class="arb-equipo-nom">${esc(n)}</div>
            <div class="arb-equipo-detalle">
              ${totalJug>0?`<span class="muted" style="font-size:.8rem">⚠ ${totalJug} jugado${totalJug!==1?'s':''} pendiente${totalJug!==1?'s':''} ($${(totalJug*precioA).toLocaleString('es-MX')})</span>`:''}
              ${futuros>0?`<span class="muted" style="font-size:.8rem">📅 ${futuros} futuro${futuros!==1?'s':''} ($${(futuros*precioA).toLocaleString('es-MX')})</span>`:''}
              ${saldo>0?`<span style="color:#10b981;font-size:.8rem">✓ Saldo a favor: $${saldo.toLocaleString('es-MX')}</span>`:''}
              ${montoNeto===0&&totalJug===0?'<span class="badge win">✓ Al corriente</span>':`<strong>Pendiente neto: $${montoNeto.toLocaleString('es-MX')}</strong>`}
            </div>
            <div class="arb-equipo-acciones">
              <button class="btn secondary" style="font-size:.8rem" onclick="abrirPagoEquipo('${sid}')">💸 Registrar pago</button>
            </div>
            <div id="arb-form-${sid}" style="display:none;width:100%;margin-top:.5rem" class="arb-equipo-form">
              <input type="number" id="arb-monto-${sid}" value="${montoNeto||precioA}" min="1"
                style="width:110px;padding:.3rem .5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text)">
              <button class="btn" style="font-size:.8rem" onclick="confirmarPagoEquipoLiga('${esc(n)}','${sid}',${totalJug},${precioA})">✓ Confirmar</button>
              <button class="btn secondary" style="font-size:.8rem" onclick="abrirPagoEquipo('${sid}')">Cancelar</button>
              <p class="muted" style="font-size:.74rem;margin-top:.3rem">Puedes pagar cualquier monto parcial — el resto queda como saldo a favor.</p>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : ''}

    <!-- Detalle por partido -->
    <div class="card" style="margin-top:1.2rem">
      <p class="card-subtitle">Detalle de arbitrajes por partido</p>
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
                ${p.pago_arb_a ? '<span class="arb-pill-estado">✓ Pagado</span>'
                  : `<button class="arb-pill-btn" onclick="pagarArbPartido('${p.id}','pago_arb_a')">Pagar $${precioA}</button>`}
              </div>
              <div class="arb-pill ${p.pago_arb_b?'pagado':'pendiente'}">
                <span class="arb-pill-nom">${esc(p.equipo_b)}</span>
                ${p.pago_arb_b ? '<span class="arb-pill-estado">✓ Pagado</span>'
                  : `<button class="arb-pill-btn" onclick="pagarArbPartido('${p.id}','pago_arb_b')">Pagar $${precioA}</button>`}
              </div>
            </div>
          </div>`).join('')}
    </div>`;

  window.pagarInscripcionLiga = async id => {
    if (!confirmar('¿Confirmar pago de inscripción?')) return;
    await actualizarEquipo(id, { inscripcion_pagada: true });
    renderTab('finanzas', document.querySelector('#liga-content'));
    toast('Inscripción registrada ✓');
  };

  window.pagarArbPartido = async (id, campo) => {
    await actualizarPartido(id, { [campo]: true });
    renderTab('finanzas', document.querySelector('#liga-content'));
    toast('Arbitraje registrado ✓');
  };

  window.abrirPagoEquipo = sid => {
    const form = document.getElementById(`arb-form-${sid}`);
    if (form) form.style.display = form.style.display==='none'?'flex':'none';
  };

  window.confirmarPagoEquipoLiga = async (nombre, sid, totalJug, precioA) => {
    const inp   = document.getElementById(`arb-monto-${sid}`);
    const monto = parseInt(inp?.value);
    if (!monto||monto<1) { toast('Ingresa un monto válido','error'); return; }
    const eq    = equipos.find(e=>e.nombre===nombre);
    if (!eq) return;
    let resto = (eq.arb_saldo||0) + monto;

// Aplicar a jugados pendientes primero
const pendientes = partidos.filter(p=>
  !p.es_playoff&&p.jugado&&
  ((p.equipo_a===nombre&&!p.pago_arb_a)||(p.equipo_b===nombre&&!p.pago_arb_b))
).sort((a,b)=>(a.fecha||'').localeCompare(b.fecha||''));

for (const p of pendientes) {
  if (resto < precioA) break;
  const campo = p.equipo_a===nombre ? 'pago_arb_a' : 'pago_arb_b';
  await actualizarPartido(p.id, { [campo]: true });
  resto -= precioA;
}

// El resto queda como saldo a favor (incluye pagos anticipados de futuros)
await actualizarEquipo(eq.id, { arb_saldo: resto });
toast(`✓ $${monto.toLocaleString('es-MX')} registrado${resto>0?` — Saldo a favor: $${resto.toLocaleString('es-MX')}`:''}`);
renderTab('finanzas', document.querySelector('#liga-content'));
  };
}

// ── Config ───────────────────────────────────────────────────
function renderConfigTab(el) {
  const cfg = { nombre:'', temporada:'', vueltas:2, usarPuntos:true, usarSets:true,
    ptsVictoria:2, ptsBono:1, ptsDerota:0, precioInscripcion:500, precioArbitraje:120,
    colorAcento:'#f59e0b', permitirAdelantoArb:true, ...(LIGA.config||{}) };

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
          <span><strong>Permitir adelanto de arbitrajes</strong></span>
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
      <p class="card-subtitle">🔗 Código de acceso público</p>
      <p class="muted" style="font-size:.85rem;margin-bottom:.8rem">Comparte este código para que cualquiera vea tu liga sin iniciar sesión.</p>
      <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap">
        <code class="codigo-chip" style="font-size:1.4rem;padding:.5rem 1.2rem">${LIGA.codigo}</code>
        <button class="btn secondary" id="btn-renovar-codigo">🔄 Renovar código</button>
        <button class="btn secondary" id="btn-copiar-link">📋 Copiar link</button>
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
      nombre: el.querySelector('#cfg-nom').value.trim(),
      temporada: el.querySelector('#cfg-temp').value.trim(),
      vueltas: parseInt(el.querySelector('#cfg-vueltas').value),
      precioInscripcion: parseInt(el.querySelector('#cfg-pinsc').value)||500,
      precioArbitraje: parseInt(el.querySelector('#cfg-parb').value)||120,
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
      usarSets: el.querySelector('#cfg-sets').checked,
      usarPuntos: el.querySelector('#cfg-pts').checked,
      ptsVictoria: parseInt(el.querySelector('#cfg-ptsV').value)||2,
      ptsBono: parseInt(el.querySelector('#cfg-ptsB').value)||0,
      ptsDerota: parseInt(el.querySelector('#cfg-ptsD').value)||0,
    };
    await actualizarLiga(LIGA.id, { config: nuevoCfg });
    LIGA.config = nuevoCfg; toast('Formato guardado ✓');
  };

  el.querySelector('#btn-renovar-codigo').onclick = async () => {
    if (!confirmar('¿Renovar el código? El anterior dejará de funcionar.')) return;
    const nuevo = await renovarCodigo(LIGA.id);
    LIGA.codigo = nuevo; renderTab('config', el); toast('Código renovado ✓');
  };

  el.querySelector('#btn-copiar-link').onclick = () => {
    const link = `${location.origin}/?liga=${LIGA.codigo}`;
    navigator.clipboard?.writeText(link).then(()=>toast('Link copiado ✓')).catch(()=>toast(link));
  };

  el.querySelector('#btn-invitar').onclick = async () => {
    const email = el.querySelector('#invite-email').value.trim();
    if (!email) { toast('Escribe un correo','error'); return; }
    try {
      await invitarCoAdmin(LIGA.id, email);
      el.querySelector('#invite-email').value = '';
      cargarCoAdmins(el.querySelector('#lista-coadmins'));
      toast('Co-admin invitado ✓');
    } catch(err) { toast(err.message,'error'); }
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
      cargarCoAdmins(cont); toast('Co-admin eliminado');
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
  for (let i=0;i<noms.length;i++)
    for (let j=i+1;j<noms.length;j++)
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
  equipos.forEach(e => { t[e.nombre]={equipo:e.nombre,pj:0,pg:0,pp:0,sg:0,sp:0,pts:0}; });
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
  return Object.values(t).sort((a,b)=>{
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
    const conPts=r.usarPuntosSet!==false;
    return `<div class="set-block" id="bloque-set${idx}">
      <h4>${esc(r.nombre)}${esD?' <small style="color:var(--accent);font-size:.7rem">(Desempate)</small>':''}</h4>
      <div class="set-score">
        <input type="number" id="s${idx}a" min="0" max="999" placeholder="Eq A">
        <span>—</span>
        <input type="number" id="s${idx}b" min="0" max="999" placeholder="Eq B">
      </div>
      <p class="note">${conPts?`Mín ${r.puntos} · Dif ≥ ${r.diferencia}`:'Solo ganador'}</p>
    </div>`;
  }).join('');
}

function leerSets(el, reglas) {
  const sets=[]; let sA=0,sB=0;
  for (let i=0;i<reglas.length;i++) {
    const bloque=el.querySelector(`#bloque-set${i+1}`);
    if (!bloque||bloque.style.display==='none') break;
    const pA=parseInt(el.querySelector(`#s${i+1}a`).value);
    const pB=parseInt(el.querySelector(`#s${i+1}b`).value);
    if (isNaN(pA)||isNaN(pB)) return {ok:false,msg:`Completa el set ${i+1}`};
    const r=reglas[i]||reglas[reglas.length-1];
    if (r.usarPuntosSet!==false) {
      const max=Math.max(pA,pB),min=Math.min(pA,pB);
      if (max<r.puntos||(max-min)<r.diferencia) return {ok:false,msg:`Set ${i+1} inválido: ${pA}-${pB}`};
    } else { if (pA===pB) return {ok:false,msg:`Set ${i+1}: debe haber un ganador`}; }
    sets.push({pA,pB});
    if(pA>pB) sA++; else sB++;
  }
  const setsParaGanar=Math.ceil(reglas.length/2);
  const ganador=sA>=setsParaGanar?'A':sB>=setsParaGanar?'B':null;
  if (!ganador) return {ok:false,msg:'No hay ganador aún. Agrega más sets.'};
  return {ok:true,sets,sA,sB,ganador};
}
