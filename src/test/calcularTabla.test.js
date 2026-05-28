// Feature: react-migration
// Unit tests for calcularTabla — Requirements 5.4, 5.5, 5.6

import { describe, it, expect } from 'vitest';
import { calcularTabla } from '../utils/calcularTabla.js';

// Default config used across most tests
const defaultCfg = { usarPuntos: true, usarSets: true, ptsVictoria: 2, ptsBono: 1, ptsDerota: 0 };

describe('calcularTabla', () => {
  // ── Empty teams ──────────────────────────────────────────────────────────
  it('returns an empty array when teams array is empty', () => {
    const result = calcularTabla([], [], defaultCfg);
    expect(result).toEqual([]);
  });

  // ── Single team, no matches ──────────────────────────────────────────────
  it('returns an all-zero row for a single team with no matches', () => {
    const equipos = [{ nombre: 'Equipo A' }];
    const result = calcularTabla(equipos, [], defaultCfg);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ equipo: 'Equipo A', pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, pts: 0 });
  });

  // ── Playoff exclusion ────────────────────────────────────────────────────
  it('excludes playoff matches (es_playoff: true) from standings', () => {
    const equipos = [{ nombre: 'Equipo A' }, { nombre: 'Equipo B' }];
    const partidos = [
      {
        jugado: true,
        es_playoff: true,
        equipo_a: 'Equipo A',
        equipo_b: 'Equipo B',
        sets_a: 3,
        sets_b: 1,
        ganador: 'A',
      },
    ];
    const result = calcularTabla(equipos, partidos, defaultCfg);
    // Playoff match must not affect any stats
    const rowA = result.find(r => r.equipo === 'Equipo A');
    const rowB = result.find(r => r.equipo === 'Equipo B');
    expect(rowA).toEqual({ equipo: 'Equipo A', pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, pts: 0 });
    expect(rowB).toEqual({ equipo: 'Equipo B', pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, pts: 0 });
  });

  it('counts non-playoff matches but ignores playoff matches in the same list', () => {
    const equipos = [{ nombre: 'Equipo A' }, { nombre: 'Equipo B' }];
    const partidos = [
      // Regular match — should count
      {
        jugado: true,
        es_playoff: false,
        equipo_a: 'Equipo A',
        equipo_b: 'Equipo B',
        sets_a: 3,
        sets_b: 0,
        ganador: 'A',
      },
      // Playoff match — should NOT count
      {
        jugado: true,
        es_playoff: true,
        equipo_a: 'Equipo A',
        equipo_b: 'Equipo B',
        sets_a: 3,
        sets_b: 2,
        ganador: 'A',
      },
    ];
    const result = calcularTabla(equipos, partidos, defaultCfg);
    const rowA = result.find(r => r.equipo === 'Equipo A');
    const rowB = result.find(r => r.equipo === 'Equipo B');
    // Only the regular match counts
    expect(rowA.pj).toBe(1);
    expect(rowB.pj).toBe(1);
    expect(rowA.pg).toBe(1);
    expect(rowB.pp).toBe(1);
  });

  // ── usarPuntos: false ────────────────────────────────────────────────────
  it('produces pts: 0 for all rows when usarPuntos is false', () => {
    const equipos = [{ nombre: 'Equipo A' }, { nombre: 'Equipo B' }, { nombre: 'Equipo C' }];
    const partidos = [
      {
        jugado: true,
        es_playoff: false,
        equipo_a: 'Equipo A',
        equipo_b: 'Equipo B',
        sets_a: 3,
        sets_b: 1,
        ganador: 'A',
      },
      {
        jugado: true,
        es_playoff: false,
        equipo_a: 'Equipo B',
        equipo_b: 'Equipo C',
        sets_a: 3,
        sets_b: 0,
        ganador: 'A',
      },
    ];
    const cfg = { ...defaultCfg, usarPuntos: false };
    const result = calcularTabla(equipos, partidos, cfg);
    result.forEach(row => {
      expect(row.pts).toBe(0);
    });
  });

  it('still records wins/losses when usarPuntos is false', () => {
    const equipos = [{ nombre: 'Equipo A' }, { nombre: 'Equipo B' }];
    const partidos = [
      {
        jugado: true,
        es_playoff: false,
        equipo_a: 'Equipo A',
        equipo_b: 'Equipo B',
        sets_a: 3,
        sets_b: 1,
        ganador: 'A',
      },
    ];
    const cfg = { ...defaultCfg, usarPuntos: false };
    const result = calcularTabla(equipos, partidos, cfg);
    const rowA = result.find(r => r.equipo === 'Equipo A');
    const rowB = result.find(r => r.equipo === 'Equipo B');
    expect(rowA.pg).toBe(1);
    expect(rowB.pp).toBe(1);
    expect(rowA.pts).toBe(0);
    expect(rowB.pts).toBe(0);
  });

  // ── usarSets: false ──────────────────────────────────────────────────────
  it('produces sg: 0 and sp: 0 for all rows when usarSets is false', () => {
    const equipos = [{ nombre: 'Equipo A' }, { nombre: 'Equipo B' }];
    const partidos = [
      {
        jugado: true,
        es_playoff: false,
        equipo_a: 'Equipo A',
        equipo_b: 'Equipo B',
        sets_a: 3,
        sets_b: 2,
        ganador: 'A',
      },
    ];
    const cfg = { ...defaultCfg, usarSets: false };
    const result = calcularTabla(equipos, partidos, cfg);
    result.forEach(row => {
      expect(row.sg).toBe(0);
      expect(row.sp).toBe(0);
    });
  });

  it('still records wins/losses and points when usarSets is false', () => {
    const equipos = [{ nombre: 'Equipo A' }, { nombre: 'Equipo B' }];
    const partidos = [
      {
        jugado: true,
        es_playoff: false,
        equipo_a: 'Equipo A',
        equipo_b: 'Equipo B',
        sets_a: 3,
        sets_b: 2,
        ganador: 'A',
      },
    ];
    const cfg = { ...defaultCfg, usarSets: false };
    const result = calcularTabla(equipos, partidos, cfg);
    const rowA = result.find(r => r.equipo === 'Equipo A');
    const rowB = result.find(r => r.equipo === 'Equipo B');
    expect(rowA.pg).toBe(1);
    expect(rowA.pts).toBe(2); // ptsVictoria = 2, no bono because usarSets is false
    expect(rowB.pp).toBe(1);
    expect(rowB.pts).toBe(0);
  });

  // ── Unplayed matches are ignored ─────────────────────────────────────────
  it('ignores matches where jugado is false', () => {
    const equipos = [{ nombre: 'Equipo A' }, { nombre: 'Equipo B' }];
    const partidos = [
      {
        jugado: false,
        es_playoff: false,
        equipo_a: 'Equipo A',
        equipo_b: 'Equipo B',
        sets_a: 3,
        sets_b: 0,
        ganador: 'A',
      },
    ];
    const result = calcularTabla(equipos, partidos, defaultCfg);
    result.forEach(row => {
      expect(row).toMatchObject({ pj: 0, pg: 0, pp: 0, sg: 0, sp: 0, pts: 0 });
    });
  });
});
