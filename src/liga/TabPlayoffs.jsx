// ============================================================
//  TabPlayoffs.jsx — Playoffs del organizador (React)
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { getPlayoffs, guardarPlayoffs } from '../lib/db.js';
import { toast, formatFecha } from '../lib/ui.js';

// ════════════════════════════════════════════════════════════
//  LÓGICA DE BRACKET
// ════════════════════════════════════════════════════════════

// Genera el bracket inicial a partir de la tabla de posiciones
function generarBracket(equiposOrdenados, cfg = {}) {
  const n = equiposOrdenados.length;
  // Tamaños válidos: 4, 8, 16
  const size = n >= 8 ? 8 : 4;
  const participantes = equiposOrdenados.slice(0, size);

  // Emparejamiento estilo "serpiente": 1 vs 8, 2 vs 7, etc.
  const cruces = [];
  for (let i = 0; i < size / 2; i++) {
    cruces.push({
      id:      `r1_${i}`,
      ronda:   1,
      pos:     i,
      equipoA: participantes[i]?.nombre || null,
      equipoB: participantes[size - 1 - i]?.nombre || null,
      setsA:   null,
      setsB:   null,
      ganador: null,
      fecha:   null,
    });
  }

  // Rondas siguientes vacías
  const rondas = [cruces];
  let prev = cruces;
  let ronda = 2;
  while (prev.length > 1) {
    const siguiente = [];
    for (let i = 0; i < prev.length / 2; i++) {
      siguiente.push({
        id:      `r${ronda}_${i}`,
        ronda,
        pos:     i,
        equipoA: null,
        equipoB: null,
        setsA:   null,
        setsB:   null,
        ganador: null,
        fecha:   null,
      });
    }
    rondas.push(siguiente);
    prev = siguiente;
    ronda++;
  }

  return {
    rondas,
    campeon:   null,
    size,
    creado:    new Date().toISOString(),
    usarSets:  cfg.usarSets !== false,
  };
}

// Propaga ganadores al siguiente cruce
function propagarGanador(bracket, cruceid, ganador) {
  const nuevo = JSON.parse(JSON.stringify(bracket));
  // Encontrar el cruce
  let cruce = null;
  for (const ronda of nuevo.rondas) {
    cruce = ronda.find(c => c.id === cruceid);
    if (cruce) break;
  }
  if (!cruce) return nuevo;

  cruce.ganador = ganador;

  // Propagar al siguiente cruce de la siguiente ronda
  const idxRonda = nuevo.rondas.findIndex(r => r.find(c => c.id === cruceid));
  const nextRonda = nuevo.rondas[idxRonda + 1];
  if (nextRonda) {
    const nextPos  = Math.floor(cruce.pos / 2);
    const nextCruce = nextRonda[nextPos];
    if (nextCruce) {
      if (cruce.pos % 2 === 0) nextCruce.equipoA = ganador;
      else                      nextCruce.equipoB = ganador;
    }
  }

  // Campeón si es la final
  if (!nextRonda) nuevo.campeon = ganador;

  return nuevo;
}

const NOMBRES_RONDA = {
  1: { 8: 'Cuartos de final', 4: 'Semifinales', 2: 'Final' },
  2: { 8: 'Semifinales',      4: 'Final' },
  3: { 8: 'Final' },
};

function nombreRonda(rondaNum, totalRondas) {
  const map = {
    [totalRondas]:     'Final',
    [totalRondas - 1]: 'Semifinales',
    [totalRondas - 2]: 'Cuartos de final',
  };
  return map[rondaNum] || `Ronda ${rondaNum}`;
}

// ════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function TabPlayoffs({ liga, equipos, partidos, refresh }) {
  const [bracket,  setBracket]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [editando, setEditando] = useState(null); // id del cruce en edición

  const cfg      = liga.config || {};
  const usarSets = cfg.usarSets !== false;

  // Tabla para ordenar participantes
  const tabla = calcularTabla(equipos, partidos, cfg);

  const cargar = useCallback(async () => {
    setLoading(true);
    const data = await getPlayoffs(liga.id);
    setBracket(data);
    setLoading(false);
  }, [liga.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const iniciarBracket = async () => {
    if (tabla.length < 4) {
      toast('Se necesitan al menos 4 equipos con partidos jugados', 'error');
      return;
    }
    const nuevo = generarBracket(tabla, cfg);
    await guardarPlayoffs(liga.id, nuevo);
    setBracket(nuevo);
    toast('Bracket generado ✓');
  };

  const resetBracket = async () => {
    if (!window.confirm('¿Reiniciar el bracket? Se perderán todos los resultados de playoffs.')) return;
    await guardarPlayoffs(liga.id, null);
    setBracket(null);
    toast('Bracket reiniciado');
  };

  const guardarResultado = async (cruceId, setsA, setsB, ganador, fecha) => {
    const nuevo = JSON.parse(JSON.stringify(bracket));
    // Actualizar el cruce
    for (const ronda of nuevo.rondas) {
      const cruce = ronda.find(c => c.id === cruceId);
      if (cruce) {
        cruce.setsA   = setsA;
        cruce.setsB   = setsB;
        cruce.ganador = ganador;
        cruce.fecha   = fecha;
        break;
      }
    }
    // Propagar ganador
    const actualizado = propagarGanador(nuevo, cruceId, ganador);
    await guardarPlayoffs(liga.id, actualizado);
    setBracket(actualizado);
    setEditando(null);
    toast(`✓ Resultado guardado — ganó ${ganador}`);
  };

  if (loading) return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;

  if (!bracket) {
    return (
      <div style={{ maxWidth: 600 }}>
        <h2>🏆 <span>Playoffs</span></h2>
        <div className="card" style={{ marginTop: '1rem' }}>
          <p className="card-subtitle">Participantes según tabla actual</p>
          {tabla.length < 4
            ? <p className="muted">Se necesitan al menos 4 equipos con partidos jugados para generar el bracket.</p>
            : (
              <>
                <p className="muted" style={{ fontSize: '.85rem', marginBottom: '1rem' }}>
                  Se tomarán los primeros {tabla.length >= 8 ? 8 : 4} equipos de la tabla.
                </p>
                <div className="fixture-list">
                  {tabla.slice(0, tabla.length >= 8 ? 8 : 4).map((r, i) => (
                    <div key={r.equipo} className="fixture-item" style={{ gap: '.8rem' }}>
                      <span className="badge win">#{i + 1}</span>
                      <span style={{ fontWeight: 600, flex: 1 }}>{r.equipo}</span>
                      <span className="muted" style={{ fontSize: '.82rem' }}>{r.pg}G · {r.pp}P · {r.pts}pts</span>
                    </div>
                  ))}
                </div>
                <button className="btn" style={{ marginTop: '1.2rem' }} onClick={iniciarBracket}>
                  🏆 Generar bracket
                </button>
              </>
            )
          }
        </div>
      </div>
    );
  }

  const totalRondas = bracket.rondas.length;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>🏆 <span>Playoffs</span></h2>
        {bracket.campeon && (
          <span className="badge win" style={{ fontSize: '1rem', padding: '.3rem .8rem' }}>
            🥇 Campeón: {bracket.campeon}
          </span>
        )}
        <button className="btn danger small" style={{ marginLeft: 'auto' }} onClick={resetBracket}>
          🔄 Reiniciar bracket
        </button>
      </div>

      {/* Bracket visual */}
      <div className="bracket-wrap">
        {bracket.rondas.map((ronda, ri) => (
          <div key={ri} className="bracket-ronda">
            <div className="bracket-ronda-titulo">
              {nombreRonda(ri + 1, totalRondas)}
            </div>
            <div className="bracket-cruces">
              {ronda.map(cruce => (
                <CruceCard
                  key={cruce.id}
                  cruce={cruce}
                  usarSets={usarSets}
                  editando={editando === cruce.id}
                  onEditar={() => setEditando(cruce.id)}
                  onCancelar={() => setEditando(null)}
                  onGuardar={(sA, sB, gan, fecha) => guardarResultado(cruce.id, sA, sB, gan, fecha)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  TARJETA DE CRUCE
// ════════════════════════════════════════════════════════════
function CruceCard({ cruce, usarSets, editando, onEditar, onCancelar, onGuardar }) {
  const [setsA, setSetsA]   = useState(cruce.setsA ?? '');
  const [setsB, setSetsB]   = useState(cruce.setsB ?? '');
  const [ganador, setGanador] = useState(cruce.ganador || '');
  const [fecha, setFecha]   = useState(cruce.fecha || '');

  // Sincronizar al abrir edición
  useEffect(() => {
    if (editando) {
      setSetsA(cruce.setsA ?? '');
      setSetsB(cruce.setsB ?? '');
      setGanador(cruce.ganador || '');
      setFecha(cruce.fecha || '');
    }
  }, [editando]);

  const pendiente = !cruce.equipoA || !cruce.equipoB;

  const confirmar = () => {
    if (!ganador) { toast('Selecciona el ganador', 'error'); return; }
    if (usarSets && (setsA === '' || setsB === '')) {
      toast('Ingresa los sets', 'error'); return;
    }
    onGuardar(
      usarSets ? parseInt(setsA) : null,
      usarSets ? parseInt(setsB) : null,
      ganador,
      fecha || null,
    );
  };

  return (
    <div className={`bracket-cruce ${cruce.ganador ? 'jugado' : ''} ${pendiente ? 'pendiente' : ''}`}>
      {/* Equipo A */}
      <div className={`bracket-equipo ${cruce.ganador === cruce.equipoA ? 'ganador' : ''} ${cruce.ganador && cruce.ganador !== cruce.equipoA ? 'perdedor' : ''}`}>
        <span className="bracket-equipo-nom">{cruce.equipoA || <span className="muted">Por definir</span>}</span>
        {cruce.ganador && usarSets && <span className="bracket-sets">{cruce.setsA}</span>}
        {cruce.ganador === cruce.equipoA && <span className="bracket-trophy">🏆</span>}
      </div>

      <div className="bracket-separador">vs</div>

      {/* Equipo B */}
      <div className={`bracket-equipo ${cruce.ganador === cruce.equipoB ? 'ganador' : ''} ${cruce.ganador && cruce.ganador !== cruce.equipoB ? 'perdedor' : ''}`}>
        <span className="bracket-equipo-nom">{cruce.equipoB || <span className="muted">Por definir</span>}</span>
        {cruce.ganador && usarSets && <span className="bracket-sets">{cruce.setsB}</span>}
        {cruce.ganador === cruce.equipoB && <span className="bracket-trophy">🏆</span>}
      </div>

      {cruce.fecha && !editando && (
        <div className="bracket-fecha">{formatFecha(cruce.fecha)}</div>
      )}

      {/* Botón editar */}
      {!pendiente && !editando && (
        <button className="btn secondary small" style={{ marginTop: '.5rem', width: '100%' }} onClick={onEditar}>
          {cruce.ganador ? '✏ Editar resultado' : '+ Registrar resultado'}
        </button>
      )}

      {/* Formulario inline */}
      {editando && (
        <div className="bracket-form">
          <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.5rem' }}>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
              style={{ flex: 1, padding: '.3rem .5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '.82rem' }} />
          </div>
          {usarSets && (
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.5rem' }}>
              <input type="number" min={0} max={9} placeholder="Sets A"
                value={setsA} onChange={e => setSetsA(e.target.value)}
                style={{ width: 64, textAlign: 'center', padding: '.3rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 700 }} />
              <span className="muted">—</span>
              <input type="number" min={0} max={9} placeholder="Sets B"
                value={setsB} onChange={e => setSetsB(e.target.value)}
                style={{ width: 64, textAlign: 'center', padding: '.3rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 700 }} />
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem', marginBottom: '.5rem' }}>
            <label style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Ganador</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', fontSize: '.88rem' }}>
              <input type="radio" name={`gan-${cruce.id}`} value={cruce.equipoA}
                checked={ganador === cruce.equipoA} onChange={() => setGanador(cruce.equipoA)} />
              {cruce.equipoA}
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', fontSize: '.88rem' }}>
              <input type="radio" name={`gan-${cruce.id}`} value={cruce.equipoB}
                checked={ganador === cruce.equipoB} onChange={() => setGanador(cruce.equipoB)} />
              {cruce.equipoB}
            </label>
          </div>
          <div style={{ display: 'flex', gap: '.4rem' }}>
            <button className="btn small" onClick={confirmar}>✓ Guardar</button>
            <button className="btn secondary small" onClick={onCancelar}>Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────
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