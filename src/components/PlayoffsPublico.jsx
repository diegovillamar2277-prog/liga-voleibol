// ============================================================
//  PlayoffsPublico.jsx — Bracket de playoffs (vista pública)
// ============================================================
import { formatFecha } from '../lib/ui.js';

function nombreRonda(rondaNum, totalRondas) {
  const map = {
    [totalRondas]:     'Final',
    [totalRondas - 1]: 'Semifinales',
    [totalRondas - 2]: 'Cuartos de final',
  };
  return map[rondaNum] || `Ronda ${rondaNum}`;
}

function CrucePublico({ cruce, usarSets }) {
  const pendiente = !cruce.equipoA || !cruce.equipoB;

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

      {cruce.fecha && (
        <div className="bracket-fecha">{formatFecha(cruce.fecha)}</div>
      )}
    </div>
  );
}

export default function PlayoffsPublico({ bracket, cfg = {} }) {
  if (!bracket) {
    return (
      <div className="empty-state" style={{ padding: '2rem 0' }}>
        <div className="empty-icon">🏆</div>
        <p className="muted">Los playoffs aún no han comenzado.</p>
      </div>
    );
  }

  const usarSets    = cfg.usarSets !== false;
  const totalRondas = bracket.rondas?.length ?? 0;

  if (!Array.isArray(bracket.rondas) || totalRondas === 0) {
    return (
      <div className="empty-state" style={{ padding: '2rem 0' }}>
        <div className="empty-icon">⚠️</div>
        <p className="muted">El bracket tiene un formato inválido.</p>
      </div>
    );
  }

  return (
    <div>
      {bracket.campeon && (
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <span className="badge win" style={{ fontSize: '1.1rem', padding: '.4rem 1rem' }}>
            🥇 Campeón: {bracket.campeon}
          </span>
        </div>
      )}

      <div className="bracket-wrap">
        {bracket.rondas.map((ronda, ri) => (
          <div key={ri} className="bracket-ronda">
            <div className="bracket-ronda-titulo">
              {nombreRonda(ri + 1, totalRondas)}
            </div>
            <div className="bracket-cruces">
              {ronda.map(cruce => (
                <CrucePublico
                  key={cruce.id}
                  cruce={cruce}
                  usarSets={usarSets}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
