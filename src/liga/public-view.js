// ============================================================
//  public-view.js — Vista pública por código de liga
// ============================================================
import { esc, formatFecha } from '../lib/ui.js';

export async function renderPublicView(container, codigoInicial = '') {
  container.innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="topbar-left">
          <span class="topbar-logo">🏐</span>
          <span class="topbar-title" id="pub-liga-nombre">Liga Voleibol</span>
        </div>
        <div class="topbar-right">
          <button class="btn secondary small" id="btn-ir-login">Iniciar sesión</button>
        </div>
      </header>
      <div id="pub-body">
        ${codigoInicial
          ? '<div class="loading-spinner" style="margin:3rem auto"></div>'
          : renderBuscador()}
      </div>
    </div>`;

  container.querySelector('#btn-ir-login').onclick = () =>
    document.dispatchEvent(new CustomEvent('nav', { detail: { page: 'login' } }));

  if (codigoInicial) {
    await cargarLiga(codigoInicial);
  }
}

function renderBuscador() {
  return `
    <div class="empty-state" style="max-width:420px;margin:4rem auto;padding:2rem">
      <div class="empty-icon">🏐</div>
      <h2>Ver mi liga</h2>
      <p class="muted" style="margin-bottom:1.5rem">
        Ingresa el código de tu liga para ver la tabla de posiciones y resultados.
      </p>
      <div style="display:flex;gap:.6rem">
        <input type="text" id="input-codigo" placeholder="Ej: QMT-X59"
          maxlength="20"
          style="flex:1;text-transform:uppercase;font-size:1.1rem;letter-spacing:.1rem;
          padding:.6rem 1rem;border-radius:10px;border:1px solid var(--border);
          background:var(--bg);color:var(--text)"
          onkeydown="if(event.key==='Enter') window.buscarLiga()">
        <button class="btn" onclick="window.buscarLiga()">Entrar</button>
      </div>
      <div id="buscar-error" class="auth-error" style="display:none;margin-top:.6rem"></div>
    </div>`;
}

async function cargarLiga(codigo) {
  const el = document.getElementById('pub-body');
  if (!el) return;
  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.39.0');
    const client = createClient(
      'https://xevzdswtsbmjzchgefox.supabase.co',
      'sb_publishable_ks-bCTiUUmxtf-FJuiL1_g_hJhUlvQy'
    );

    const { data: liga, error } = await client
      .from('leagues')
      .select('*')
      .eq('codigo', codigo.toUpperCase())
      .eq('activa', true)
      .single();

    if (error || !liga) throw new Error('no encontrada');

    const [{ data: equipos }, { data: partidos }] = await Promise.all([
      client.from('teams').select('*').eq('league_id', liga.id).order('created_at'),
      client.from('matches').select('*').eq('league_id', liga.id).order('fecha')
    ]);

    const nombreEl = document.querySelector('#pub-liga-nombre');
    if (nombreEl) nombreEl.textContent = liga.nombre;

    renderLigaPublica(el, liga, equipos || [], partidos || []);
  } catch (err) {
    el.innerHTML = renderBuscador();
    const errEl = document.getElementById('buscar-error');
    if (errEl) {
      errEl.textContent = 'Código no válido. Verifica e intenta de nuevo.';
      errEl.style.display = 'block';
    }
  }
}

window.buscarLiga = async () => {
  const inp = document.getElementById('input-codigo');
  const err = document.getElementById('buscar-error');
  if (!inp) return;
  const codigo = inp.value.trim().toUpperCase();
  if (!codigo) {
    if (err) { err.textContent = 'Escribe el código'; err.style.display = 'block'; }
    return;
  }
  if (err) err.style.display = 'none';
  const btn = inp.nextElementSibling;
  if (btn) { btn.disabled = true; btn.textContent = 'Buscando…'; }
  await cargarLiga(codigo);
  if (btn) { btn.disabled = false; btn.textContent = 'Entrar'; }
};

function renderLigaPublica(el, liga, equipos, partidos) {
  const cfg = liga.config || {};
  el.innerHTML = `
    <nav class="tab-nav">
      <button data-tab="tabla" class="active">Tabla</button>
      <button data-tab="partidos">Resultados</button>
      <button data-tab="fixture">Fixture</button>
    </nav>
    <div style="text-align:center;margin:.5rem 0">
      <code class="codigo-chip" style="font-size:.8rem;opacity:.6">${liga.codigo}</code>
      ${liga.temporada ? `<span class="muted" style="font-size:.8rem;margin-left:.5rem">· ${esc(liga.temporada)}</span>` : ''}
    </div>
    <section id="pub-content" class="section"></section>`;

  const render = tab => {
    const content = document.getElementById('pub-content');
    if (!content) return;
    if (tab === 'tabla')    renderTablaPublica(content, equipos, partidos, cfg);
    if (tab === 'partidos') renderResultados(content, partidos, cfg);
    if (tab === 'fixture')  renderFixturePublico(content, equipos, partidos, cfg);
  };

  el.querySelectorAll('.tab-nav button').forEach(btn => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.tab-nav button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      render(btn.dataset.tab);
    });
  });

  render('tabla');
}

function renderTablaPublica(el, equipos, partidos, cfg) {
  const usarPts  = cfg.usarPuntos  !== false;
  const usarSets = cfg.usarSets    !== false;
  const mostrarDS = usarSets && cfg.mostrarColDifSets !== false;
  const tabla = calcularTabla(equipos, partidos, cfg);

  if (!tabla.length) { el.innerHTML = '<p class="empty">Aún no hay equipos registrados.</p>'; return; }

  el.innerHTML = `
    <div class="tabla-wrap">
      <table class="tabla-pos">
        <thead><tr>
          <th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th>
          ${usarSets ? '<th>SG</th><th>SP</th>' : ''}
          ${mostrarDS ? '<th>DS</th>' : ''}
          ${usarPts  ? '<th>PTS</th>' : ''}
        </tr></thead>
        <tbody>
          ${tabla.map((r, i) => {
            const ds = r.sg - r.sp;
            const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
            return `<tr ${i<3?'class="top-row"':''}>
              <td>${medal||i+1}</td>
              <td><span class="team-name">${esc(r.equipo)}</span></td>
              <td>${r.pj}</td><td class="green">${r.pg}</td><td class="red">${r.pp}</td>
              ${usarSets?`<td>${r.sg}</td><td>${r.sp}</td>`:''}
              ${mostrarDS?`<td class="${ds>0?'green':ds<0?'red':''}">${ds>0?'+':''}${ds}</td>`:''}
              ${usarPts?`<td class="pts-cell">${r.pts}</td>`:''}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderResultados(el, partidos, cfg) {
  const norm = partidos.filter(p=>p.jugado&&!p.es_playoff)
    .sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  const usarSets = cfg.usarSets !== false;
  if (!norm.length) { el.innerHTML = '<p class="empty">No hay partidos registrados aún.</p>'; return; }
  el.innerHTML = `<div class="fixture-list">${norm.map(p => {
    const ganN = p.ganador==='A'?p.equipo_a:p.equipo_b;
    return `<div class="fixture-item jugado">
      <span class="badge done">V${p.vuelta}</span>
      <div class="fixture-teams">
        <span class="${p.ganador==='A'?'team-win':''}">${esc(p.equipo_a)}</span>
        <span class="fixture-vs">${usarSets?`${p.sets_a}:${p.sets_b}`:p.ganador==='A'?'G':'P'}</span>
        <span class="${p.ganador==='B'?'team-win':''}">${esc(p.equipo_b)}</span>
      </div>
      <span class="badge win">🏆 ${esc(ganN)}</span>
      ${p.fecha?`<span class="fixture-date">${formatFecha(p.fecha)}</span>`:''}
    </div>`;
  }).join('')}</div>`;
}

function renderFixturePublico(el, equipos, partidos, cfg) {
  const vueltas = cfg.vueltas||2;
  const noms = equipos.map(e=>e.nombre);
  const fixture = generarFixture(noms);
  if (!noms.length) { el.innerHTML='<p class="empty">No hay equipos.</p>'; return; }
  let html='';
  for (let v=1;v<=vueltas;v++) {
    html+=`<h3 style="margin:1.2rem 0 .6rem">Vuelta ${v}</h3><div class="fixture-list">`;
    fixture.forEach(enc=>{
      const eA=v===1?enc.local:enc.visitante;
      const eB=v===1?enc.visitante:enc.local;
      const p=partidos.find(x=>!x.es_playoff&&x.vuelta===v&&
        ((x.equipo_a===eA&&x.equipo_b===eB)||(x.equipo_a===eB&&x.equipo_b===eA)));
      html+=`<div class="fixture-item ${p?.jugado?'jugado':''}">
        <span class="badge ${v===1?'pending':'done'}">V${v}</span>
        <div class="fixture-teams">
          <span>${esc(eA)}</span>
          <span class="fixture-vs">${p?.jugado?`${p.sets_a}:${p.sets_b}`:'vs'}</span>
          <span>${esc(eB)}</span>
        </div>
        ${p?.fecha?`<span class="fixture-date">${formatFecha(p.fecha)}</span>`:''}
        ${p?.jugado?`<span class="badge win">🏆 ${esc(p.ganador==='A'?p.equipo_a:p.equipo_b)}</span>`:''}
      </div>`;
    });
    html+='</div>';
  }
  el.innerHTML=html;
}

function generarFixture(noms) {
  const enc=[];
  for(let i=0;i<noms.length;i++)
    for(let j=i+1;j<noms.length;j++)
      enc.push({local:noms[i],visitante:noms[j]});
  return enc;
}

function calcularTabla(equipos, partidos, cfg) {
  const usarPts=cfg.usarPuntos!==false, usarSets=cfg.usarSets!==false;
  const ptsV=cfg.ptsVictoria??2, ptsB=cfg.ptsBono??1, ptsD=cfg.ptsDerota??0;
  const t={};
  equipos.forEach(e=>{t[e.nombre]={equipo:e.nombre,pj:0,pg:0,pp:0,sg:0,sp:0,pts:0};});
  partidos.filter(p=>p.jugado&&!p.es_playoff).forEach(p=>{
    const a=t[p.equipo_a],b=t[p.equipo_b];
    if(!a||!b) return;
    a.pj++;b.pj++;
    if(usarSets){a.sg+=p.sets_a;a.sp+=p.sets_b;b.sg+=p.sets_b;b.sp+=p.sets_a;}
    if(p.ganador==='A'){a.pg++;b.pp++;if(usarPts){a.pts+=ptsV;b.pts+=ptsD;if(usarSets&&p.sets_b>0)b.pts+=ptsB;}}
    else{b.pg++;a.pp++;if(usarPts){b.pts+=ptsV;a.pts+=ptsD;if(usarSets&&p.sets_a>0)a.pts+=ptsB;}}
  });
  return Object.values(t).sort((a,b)=>{
    if(usarPts&&b.pts!==a.pts)return b.pts-a.pts;
    if(b.pg!==a.pg)return b.pg-a.pg;
    if(usarSets)return(b.sg-b.sp)-(a.sg-a.sp);
    return 0;
  });
}
