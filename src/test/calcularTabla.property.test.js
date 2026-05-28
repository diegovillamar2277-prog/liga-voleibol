// Feature: react-migration, Property 1: calcularTabla — no teams lost or duplicated

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { calcularTabla } from '../utils/calcularTabla.js';

/**
 * Arbitrary for a team object with a unique nombre.
 * We generate arrays of 1–20 teams with distinct names.
 */
const teamNamesArb = fc
  .uniqueArray(fc.string({ minLength: 1, maxLength: 20 }), {
    minLength: 1,
    maxLength: 20,
  });

/**
 * Given a list of team names, build an arbitrary array of matches between those teams.
 * Each match references two distinct teams from the list.
 */
function matchesArb(teamNames) {
  if (teamNames.length < 2) {
    // No matches possible with fewer than 2 teams
    return fc.constant([]);
  }
  return fc.array(
    fc
      .tuple(
        fc.integer({ min: 0, max: teamNames.length - 1 }),
        fc.integer({ min: 0, max: teamNames.length - 1 }),
        fc.boolean(),   // jugado
        fc.boolean(),   // es_playoff
        fc.integer({ min: 0, max: 3 }), // sets_a
        fc.integer({ min: 0, max: 3 }), // sets_b
        fc.constantFrom('A', 'B'),       // ganador
      )
      .filter(([idxA, idxB]) => idxA !== idxB)
      .map(([idxA, idxB, jugado, es_playoff, sets_a, sets_b, ganador]) => ({
        equipo_a: teamNames[idxA],
        equipo_b: teamNames[idxB],
        jugado,
        es_playoff,
        sets_a,
        sets_b,
        ganador,
      })),
    { maxLength: 50 },
  );
}

/** Arbitrary for a LeagueConfig object */
const cfgArb = fc.record({
  usarPuntos: fc.boolean(),
  usarSets: fc.boolean(),
  ptsVictoria: fc.integer({ min: 0, max: 5 }),
  ptsBono: fc.integer({ min: 0, max: 3 }),
  ptsDerota: fc.integer({ min: 0, max: 2 }),
});

describe('calcularTabla — Property 1: no teams lost or duplicated', () => {
  /**
   * Validates: Requirements 5.5
   *
   * For any non-empty array of teams and any array of matches between those teams,
   * calcularTabla SHALL return a standings array where every team name from the
   * input appears exactly once in the output.
   */
  it('output length equals input teams length and every team name appears exactly once', () => {
    fc.assert(
      fc.property(teamNamesArb, cfgArb, (teamNames, cfg) => {
        return fc.property(matchesArb(teamNames), (partidos) => {
          const equipos = teamNames.map((nombre) => ({ nombre }));
          const result = calcularTabla(equipos, partidos, cfg);

          // Output length must equal input teams length
          if (result.length !== equipos.length) return false;

          // Every team name must appear exactly once
          const outputNames = result.map((row) => row.equipo);
          const inputNameSet = new Set(teamNames);

          for (const name of outputNames) {
            if (!inputNameSet.has(name)) return false;
          }

          const outputNameSet = new Set(outputNames);
          if (outputNameSet.size !== outputNames.length) return false; // duplicates
          if (outputNameSet.size !== inputNameSet.size) return false;  // missing teams

          return true;
        });
      }),
      { numRuns: 100 },
    );
  });
});
