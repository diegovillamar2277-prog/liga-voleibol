// ============================================================
//  calcularTabla.js — Pure standings calculation
//  Extracted from src/liga/public-view.js and src/liga/liga-dashboard.js
// ============================================================

/**
 * Calculates league standings from teams and matches.
 *
 * @param {Array<{nombre: string}>} equipos - Array of team objects
 * @param {Array<{jugado: boolean, es_playoff: boolean, equipo_a: string, equipo_b: string, sets_a: number, sets_b: number, ganador: 'A'|'B'|null}>} partidos - Array of match objects
 * @param {{usarPuntos?: boolean, usarSets?: boolean, ptsVictoria?: number, ptsBono?: number, ptsDerota?: number}} cfg - League configuration
 * @returns {Array<{equipo: string, pj: number, pg: number, pp: number, sg: number, sp: number, pts: number}>} Sorted standings rows
 */
export function calcularTabla(equipos, partidos, cfg) {
  function calcularTabla(equipos, partidos, cfg) {
  if (!Array.isArray(equipos)) equipos = [];   // ← agregar
  if (!Array.isArray(partidos)) partidos = []; // ← agregar
  // ... resto del código
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
  return Object.values(t).sort((a,b) => {
    if (usarPts&&b.pts!==a.pts) return b.pts-a.pts;
    if (b.pg!==a.pg) return b.pg-a.pg;
    if (usarSets) return (b.sg-b.sp)-(a.sg-a.sp);
    return 0;
  });
}
