// ============================================================
//  LigaPublicaView.jsx — Vista pública de liga con React TabNav
// ============================================================
import { useState } from 'react';
import { esc, formatFecha } from '../lib/ui.js';

// ── TabNav component ─────────────────────────────────────────
function TabNav({ tabs, activeTab, onTabChange }) {
  return (
    <nav className="tab-nav">
      {tabs.map(tab => (
        <button
          key={tab.id}
          data-tab={tab.id}
          className={activeTab === tab.id ? 'active' : ''}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

// ── Tabla de posiciones ──────────────────────────────────────
function TablaPublica({ equipos, partidos, cfg }) {
  const usarPts   = cfg.usarPuntos  !== false;
  const usarSets  = cfg.usarSets    !== false;
  const mostrarDS = usarSets && cfg.mostrarColDifSets !== false;
  const tabla     = calcularTabla(equipos, partidos, cfg);

  if (!tabla.length) return <p className="empty">Aún no hay equipos registrados.</p>;

  return (
    <div className="tabla-wrap">
      <table className="tabla-pos">
        <thead>
          <tr>
            <th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th>
            {usarSets  && <><th>SG</th><th>SP</th></>}
            {mostrarDS && <th>DS</th>}
            {usarPts   && <th>PTS</th>}
          </tr>
        </thead>
        <tbody>
          {tabla.map((r, i) => {
            const ds    = r.sg - r.sp;
            const medal = i===0?'🥇':i===1?'🥈':i===2?'🥉':'';
            return (
              <tr key={r.equipo} className={i < 3 ? 'top-row' : ''}>
                <td>{medal || i + 1}</td>
                <td><span className="team-name">{r.equipo}</span></td>
                <td>{r.pj}</td>
                <td className="green">{r.pg}</td>
                <td className="red">{r.pp}</td>
                {usarSets  && <><td>{r.sg}</td><td>{r.sp}</td></>}
                {mostrarDS && <td className={ds>0?'green':ds<0?'red':''}>{ds>0?'+':''}{ds}</td>}
                {usarPts   && <td className="pts-cell">{r.pts}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Resultados ───────────────────────────────────────────────
function Resultados({ partidos, cfg }) {
  const usarSets = cfg.usarSets !== false;
  const norm = partidos
    .filter(p => p.jugado && !p.es_playoff)
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  if (!norm.length) return <p className="empty">No hay partidos registrados aún.</p>;

  return (
    <div className="fixture-list">
      {norm.map(p => {
        const ganN = p.ganador === 'A' ? p.equipo_a : p.equipo_b;
        return (
          <div key={p.id} className="fixture-item jugado">
            <span className="badge done">V{p.vuelta}</span>
            <div className="fixture-teams">
              <span className={p.ganador === 'A' ? 'team-win' : ''}>{p.equipo_a}</span>
              <span className="fixture-vs">
                {usarSets ? `${p.sets_a}:${p.sets_b}` : p.ganador === 'A' ? 'G' : 'P'}
              </span>
              <span className={p.ganador === 'B' ? 'team-win' : ''}>{p.equipo_b}</span>
            </div>
            <span className="badge win">🏆 {ganN}</span>
            {p.fecha && <span className="fixture-date">{formatFecha(p.fecha)}</span>}
          </div>
        );
      })}
    </div>
  );
}

// ── Fixture ──────────────────────────────────────────────────
function FixturePublico({ equipos, partidos, cfg }) {
  const vueltas = cfg.vueltas || 2;
  const noms    = equipos.map(e => e.nombre);
  const fixture = generarFixture(noms);

  if (!noms.length) return <p className="empty">No hay equipos.</p>;

  return (
    <>
      {Array.from({ length: vueltas }, (_, idx) => {
        const v = idx + 1;
        return (
          <div key={v}>
            <h3 style={{ margin: '1.2rem 0 .6rem' }}>Vuelta {v}</h3>
            <div className="fixture-list">
              {fixture.map((enc, i) => {
                const eA = v === 1 ? enc.local : enc.visitante;
                const eB = v === 1 ? enc.visitante : enc.local;
                const p  = partidos.find(x =>
                  !x.es_playoff && x.vuelta === v &&
                  ((x.equipo_a === eA && x.equipo_b === eB) ||
                   (x.equipo_a === eB && x.equipo_b === eA))
                );
                return (
                  <div key={i} className={`fixture-item ${p?.jugado ? 'jugado' : ''}`}>
                    <span className={`badge ${v === 1 ? 'pending' : 'done'}`}>V{v}</span>
                    <div className="fixture-teams">
                      <span>{eA}</span>
                      <span className="fixture-vs">
                        {p?.jugado ? `${p.sets_a}:${p.sets_b}` : 'vs'}
                      </span>
                      <span>{eB}</span>
                    </div>
                    {p?.fecha && <span className="fixture-date">{formatFecha(p.fecha)}</span>}
                    {p?.jugado && (
                      <span className="badge win">
                        🏆 {p.ganador === 'A' ? p.equipo_a : p.equipo_b}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}

// ── Componente principal ─────────────────────────────────────
const TABS = [
  { id: 'tabla',    label: 'Tabla'      },
  { id: 'partidos', label: 'Resultados' },
  { id: 'fixture',  label: 'Fixture'    },
];

export default function LigaPublicaView({ liga, equipos, partidos, opts = {} }) {
  const [activeTab, setActiveTab] = useState('tabla');
  const cfg           = liga.config || {};
  const identificador = liga.alias || liga.codigo;

  return (
    <>
      <TabNav tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <div style={{
        textAlign: 'center', margin: '.5rem 0',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', gap: '.6rem', flexWrap: 'wrap'
      }}>
        <code className="codigo-chip" style={{ fontSize: '.85rem' }}>{identificador}</code>
        {liga.alias && liga.codigo !== liga.alias && (
          <span className="muted" style={{ fontSize: '.75rem' }}>· código: {liga.codigo}</span>
        )}
        {liga.temporada && (
          <span className="muted" style={{ fontSize: '.8rem' }}>· {liga.temporada}</span>
        )}
        {opts.offline && (
          <span
            className="badge pending"
            title={`Datos guardados el ${new Date(opts.savedAt).toLocaleString('es-MX')}`}
          >
            📵 Offline · {formatFechaRelativa(opts.savedAt)}
          </span>
        )}
      </div>

      <section className="section">
        {activeTab === 'tabla'    && <TablaPublica  equipos={equipos} partidos={partidos} cfg={cfg} />}
        {activeTab === 'partidos' && <Resultados    partidos={partidos} cfg={cfg} />}
        {activeTab === 'fixture'  && <FixturePublico equipos={equipos} partidos={partidos} cfg={cfg} />}
      </section>
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────
function generarFixture(noms) {
  const enc = [];
  for (let i = 0; i < noms.length; i++)
    for (let j = i + 1; j < noms.length; j++)
      enc.push({ local: noms[i], visitante: noms[j] });
  return enc;
}

function calcularTabla(equipos, partidos, cfg) {
  const usarPts  = cfg.usarPuntos !== false;
  const usarSets = cfg.usarSets   !== false;
  const ptsV = cfg.ptsVictoria ?? 2;
  const ptsB = cfg.ptsBono     ?? 1;
  const ptsD = cfg.ptsDerota   ?? 0;
  const t = {};
  equipos.forEach(e => { t[e.nombre] = { equipo: e.nombre, pj:0, pg:0, pp:0, sg:0, sp:0, pts:0 }; });
  partidos.filter(p => p.jugado && !p.es_playoff).forEach(p => {
    const a = t[p.equipo_a], b = t[p.equipo_b];
    if (!a || !b) return;
    a.pj++; b.pj++;
    if (usarSets) { a.sg += p.sets_a; a.sp += p.sets_b; b.sg += p.sets_b; b.sp += p.sets_a; }
    if (p.ganador === 'A') {
      a.pg++; b.pp++;
      if (usarPts) { a.pts += ptsV; b.pts += ptsD; if (usarSets && p.sets_b > 0) b.pts += ptsB; }
    } else {
      b.pg++; a.pp++;
      if (usarPts) { b.pts += ptsV; a.pts += ptsD; if (usarSets && p.sets_a > 0) a.pts += ptsB; }
    }
  });
  return Object.values(t).sort((a, b) => {
    if (usarPts && b.pts !== a.pts) return b.pts - a.pts;
    if (b.pg !== a.pg) return b.pg - a.pg;
    if (usarSets) return (b.sg - b.sp) - (a.sg - a.sp);
    return 0;
  });
}

function formatFechaRelativa(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'hace un momento';
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)}d`;
}
