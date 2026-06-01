// ============================================================
//  TabPlayoffs.jsx — Playoffs del organizador (React)
// ============================================================
import { useState, useEffect, useCallback, useRef } from 'react';
import { getPlayoffs, guardarPlayoffs } from '../lib/db.js';
import { toast, formatFecha } from '../lib/ui.js';

// ════════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════════
function generarBracket(equiposOrdenados, cfg = {}) {
  const n    = equiposOrdenados.length;
  const size = n >= 8 ? 8 : 4;
  const participantes = equiposOrdenados.slice(0, size);

  const cruces = [];
  for (let i = 0; i < size / 2; i++) {
    cruces.push({
      id: `r1_${i}`, ronda: 1, pos: i,
      equipoA: participantes[i]?.nombre || null,
      equipoB: participantes[size - 1 - i]?.nombre || null,
      setsA: null, setsB: null, ganador: null, fecha: null,
    });
  }

  const rondas = [cruces];
  let prev = cruces, ronda = 2;
  while (prev.length > 1) {
    const siguiente = [];
    for (let i = 0; i < prev.length / 2; i++) {
      siguiente.push({
        id: `r${ronda}_${i}`, ronda, pos: i,
        equipoA: null, equipoB: null,
        setsA: null, setsB: null, ganador: null, fecha: null,
      });
    }
    rondas.push(siguiente);
    prev = siguiente;
    ronda++;
  }

  return { rondas, campeon: null, size, creado: new Date().toISOString(), usarSets: cfg.usarSets !== false };
}

function propagarGanador(bracket, cruceid, ganador) {
  const nuevo = JSON.parse(JSON.stringify(bracket));
  let cruce = null;
  for (const ronda of nuevo.rondas) {
    cruce = ronda.find(c => c.id === cruceid);
    if (cruce) break;
  }
  if (!cruce) return nuevo;
  cruce.ganador = ganador;
  const idxRonda  = nuevo.rondas.findIndex(r => r.find(c => c.id === cruceid));
  const nextRonda = nuevo.rondas[idxRonda + 1];
  if (nextRonda) {
    const nextCruce = nextRonda[Math.floor(cruce.pos / 2)];
    if (nextCruce) {
      if (cruce.pos % 2 === 0) nextCruce.equipoA = ganador;
      else                      nextCruce.equipoB = ganador;
    }
  }
  if (!nextRonda) nuevo.campeon = ganador;
  return nuevo;
}

function nombreRonda(rondaNum, totalRondas) {
  const map = {
    [totalRondas]:     'Final',
    [totalRondas - 1]: 'Semifinales',
    [totalRondas - 2]: 'Cuartos de final',
  };
  return map[rondaNum] || `Ronda ${rondaNum}`;
}

function calcularTabla(equipos, partidos, cfg) {
  const usarPts  = cfg.usarPuntos !== false;
  const usarSets = cfg.usarSets   !== false;
  const ptsV = cfg.ptsVictoria ?? 2;
  const ptsB = cfg.ptsBono     ?? 1;
  const ptsD = cfg.ptsDerota   ?? 0;
  const t = {};
  const eqs = Array.isArray(equipos) ? equipos : [];
  const pts = Array.isArray(partidos) ? partidos : [];
  eqs.forEach(e => { t[e.nombre] = { equipo: e.nombre, pj:0, pg:0, pp:0, sg:0, sp:0, pts:0 }; });
  pts.filter(p => p.jugado && !p.es_playoff).forEach(p => {
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

async function exportarImagen(ref, nombre) {
  try {
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(ref, { backgroundColor: '#0f172a', scale: 2 });
    const link = document.createElement('a');
    link.download = `${nombre}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast('Imagen descargada ✓');
  } catch (e) {
    toast('Error al exportar imagen', 'error');
  }
}

// ════════════════════════════════════════════════════════════
//  WIZARD DE CONFIGURACIÓN
// ════════════════════════════════════════════════════════════
function WizardConfig({ tabla, cfg, onConfirmar, onCancelar }) {
  const maxSize  = tabla.length >= 8 ? 8 : 4;
  const [size,     setSize]     = useState(maxSize);
  const [usarSets, setUsarSets] = useState(cfg.usarSets !== false);
  const participantes = tabla.slice(0, size);

  return (
    <div style={{ maxWidth: 560 }}>
      <h2>🏆 <span>Configurar Playoffs</span></h2>
      <div className="card" style={{ marginTop: '1rem' }}>
        <p className="card-subtitle">Número de participantes</p>
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          {[4, 8].filter(s => s <= tabla.length).map(s => (
            <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer' }}>
              <input type="radio" name="size" value={s} checked={size === s} onChange={() => setSize(s)} />
              {s} equipos
            </label>
          ))}
        </div>

        <p className="card-subtitle">Formato de resultado</p>
        <label style={{ display: 'flex', alignItems: 'center', gap: '.5rem', cursor: 'pointer', marginBottom: '1rem' }}>
          <input type="checkbox" checked={usarSets} onChange={e => setUsarSets(e.target.checked)} />
          Registrar sets (desactivar para solo ganador/perdedor)
        </label>

        <p className="card-subtitle">Participantes (según tabla actual)</p>
        <div className="fixture-list" style={{ marginBottom: '1rem' }}>
          {participantes.map((r, i) => (
            <div key={r.equipo} className="fixture-item" style={{ gap: '.8rem' }}>
              <span className="badge win">#{i + 1}</span>
              <span style={{ fontWeight: 600, flex: 1 }}>{r.equipo}</span>
              <span className="muted" style={{ fontSize: '.82rem' }}>{r.pg}G · {r.pp}P · {r.pts}pts</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '.6rem' }}>
          <button className="btn" onClick={() => onConfirmar({ size, usarSets })}>
            🏆 Generar bracket
          </button>
          <button className="btn secondary" onClick={onCancelar}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
//  COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════
export default function TabPlayoffs({ liga, equipos = [], partidos = [], refresh }) {
  const [bracket,    setBracket]    = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [editando,   setEditando]   = useState(null);
  const [mostrando,  setMostrando]  = useState('bracket'); // 'bracket' | 'wizard'
  const bracketRef = useRef(null);

  const cfg      = liga.config || {};
  const usarSets = cfg.usarSets !== false;
  const tabla    = calcularTabla(equipos, partidos, cfg);

  const cargar = useCallback(async () => {
    setLoading(true);
    const data = await getPlayoffs(liga.id);
    const esValido = data &&
      Array.isArray(data.rondas) &&
      data.rondas.length > 0 &&
      data.rondas.every(r => Array.isArray(r));
    if (data && !esValido) {
      console.warn('[TabPlayoffs] bracket inválido en DB:', data);
      setBracket(null);
    } else {
      setBracket(data);
    }
    setLoading(false);
  }, [liga.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const confirmarConfig = async ({ size, usarSets: us }) => {
    if (tabla.length < 4) { toast('Se necesitan al menos 4 equipos', 'error'); return; }
    const cfgBracket = { ...cfg, usarSets: us };
    const nuevo = generarBracket(tabla.slice(0, size), cfgBracket);
    await guardarPlayoffs(liga.id, nuevo);
    setBracket(nuevo);
    setMostrando('bracket');
    toast('Bracket generado ✓');
  };

  const resetBracket = async () => {
    if (!window.confirm('¿Reiniciar el bracket? Se perderán todos los resultados de playoffs.')) return;
    await guardarPlayoffs(liga.id, null);
    setBracket(null);
    setMostrando('bracket');
    toast('Bracket reiniciado');
  };

  const guardarResultado = async (cruceId, sA, sB, ganador, fecha) => {
    const nuevo = JSON.parse(JSON.stringify(bracket));
    for (const ronda of nuevo.rondas) {
      const cruce = ronda.find(c => c.id === cruceId);
      if (cruce) { cruce.setsA = sA; cruce.setsB = sB; cruce.ganador = ganador; cruce.fecha = fecha; break; }
    }
    const actualizado = propagarGanador(nuevo, cruceId, ganador);
    await guardarPlayoffs(liga.id, actualizado);
    setBracket(actualizado);
    setEditando(null);
    toast(`✓ Resultado guardado — ganó ${ganador}`);
  };

  if (loading) return <div className="loading-spinner" style={{ margin: '3rem auto' }} />;

  // Wizard de configuración
  if (!bracket || mostrando === 'wizard') {
    if (tabla.length < 4) {
      return (
        <div className="empty-state">
          <div className="empty-icon">🏆</div>
          <h2>Playoffs</h2>
          <p className="muted">Se necesitan al menos 4 equipos con partidos jugados para generar el bracket.</p>
        </div>
      );
    }
    return (
      <WizardConfig
        tabla={tabla}
        cfg={cfg}
        onConfirmar={confirmarConfig}
        onCancelar={bracket ? () => setMostrando('bracket') : undefined}
      />
    );
  }

  const totalRondas = bracket.rondas?.length ?? 0;
  const rondasValidas = Array.isArray(bracket.rondas) &&
    totalRondas > 0 &&
    bracket.rondas.every(r => Array.isArray(r));

  if (!rondasValidas) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⚠️</div>
        <p className="muted">El bracket tiene un formato inválido.</p>
        <button className="btn danger" style={{ marginTop: '1rem' }} onClick={resetBracket}>
          🔄 Reiniciar bracket
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0 }}>🏆 <span>Playoffs</span></h2>
        {bracket.campeon && (
          <span className="badge win" style={{ fontSize: '1rem', padding: '.3rem .8rem' }}>
            🥇 Campeón: {bracket.campeon}
          </span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="btn secondary small"
            onClick={() => exportarImagen(bracketRef.current, `playoffs-${liga.nombre}`)}>
            📷 Exportar imagen
          </button>
          <button className="btn secondary small" onClick={() => setMostrando('wizard')}>
            ⚙ Reconfigurar
          </button>
          <button className="btn danger small" onClick={resetBracket}>
            🔄 Reiniciar
          </button>
        </div>
      </div>

      <div ref={bracketRef} className="bracket-wrap">
        {bracket.rondas.map((ronda, ri) => (
          <div key={ri} className="bracket-ronda">
            <div className="bracket-ronda-titulo">{nombreRonda(ri + 1, totalRondas)}</div>
            <div className="bracket-cruces">
              {ronda.map(cruce => (
                <CruceCard
                  key={cruce.id}
                  cruce={cruce}
                  usarSets={bracket.usarSets !== false}
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
  const [setsA,   setSetsA]   = useState(cruce.setsA ?? '');
  const [setsB,   setSetsB]   = useState(cruce.setsB ?? '');
  const [ganador, setGanador] = useState(cruce.ganador || '');
  const [fecha,   setFecha]   = useState(cruce.fecha || '');

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
    if (usarSets && (setsA === '' || setsB === '')) { toast('Ingresa los sets', 'error'); return; }
    onGuardar(
      usarSets ? parseInt(setsA) : null,
      usarSets ? parseInt(setsB) : null,
      ganador,
      fecha || null,
    );
  };

  return (
    <div className={`bracket-cruce ${cruce.ganador ? 'jugado' : ''} ${pendiente ? 'pendiente' : ''}`}>
      <div className={`bracket-equipo ${cruce.ganador === cruce.equipoA ? 'ganador' : ''} ${cruce.ganador && cruce.ganador !== cruce.equipoA ? 'perdedor' : ''}`}>
        <span className="bracket-equipo-nom">{cruce.equipoA || <span className="muted">Por definir</span>}</span>
        {cruce.ganador && usarSets && <span className="bracket-sets">{cruce.setsA}</span>}
        {cruce.ganador === cruce.equipoA && <span className="bracket-trophy">🏆</span>}
      </div>
      <div className="bracket-separador">vs</div>
      <div className={`bracket-equipo ${cruce.ganador === cruce.equipoB ? 'ganador' : ''} ${cruce.ganador && cruce.ganador !== cruce.equipoB ? 'perdedor' : ''}`}>
        <span className="bracket-equipo-nom">{cruce.equipoB || <span className="muted">Por definir</span>}</span>
        {cruce.ganador && usarSets && <span className="bracket-sets">{cruce.setsB}</span>}
        {cruce.ganador === cruce.equipoB && <span className="bracket-trophy">🏆</span>}
      </div>
      {cruce.fecha && !editando && <div className="bracket-fecha">{formatFecha(cruce.fecha)}</div>}
      {!pendiente && !editando && (
        <button className="btn secondary small" style={{ marginTop: '.5rem', width: '100%' }} onClick={onEditar}>
          {cruce.ganador ? '✏ Editar resultado' : '+ Registrar resultado'}
        </button>
      )}
      {editando && (
        <div className="bracket-form">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            style={{ width: '100%', marginBottom: '.5rem', padding: '.3rem .5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: '.82rem' }} />
          {usarSets && (
            <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', marginBottom: '.5rem' }}>
              <input type="number" min={0} max={9} placeholder="Sets A" value={setsA} onChange={e => setSetsA(e.target.value)}
                style={{ width: 64, textAlign: 'center', padding: '.3rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontWeight: 700 }} />
              <span className="muted">—</span>
              <input type="number" min={0} max={9} placeholder="Sets B" value={setsB} onChange={e => setSetsB(e.target.value)}
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
