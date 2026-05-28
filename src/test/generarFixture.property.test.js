// Feature: react-migration, Property 3: generarFixture — complete round-robin coverage

import { describe, it } from 'vitest';
import * as fc from 'fast-check';
import { generarFixture } from '../utils/generarFixture.js';

/**
 * Validates: Requirements 7.7, 7.8
 *
 * Property 3: generarFixture — complete round-robin coverage
 *
 * For any array of N distinct team names (N ≥ 2), generarFixture SHALL return
 * exactly N*(N-1)/2 matchup objects, and every unordered pair of distinct team
 * names from the input SHALL appear exactly once in the output (each matchup
 * object containing exactly the fields `local` and `visitante`).
 */

// Generator: array of 2–20 distinct non-empty team name strings
const distinctTeamNames = fc.array(
  fc.string({ minLength: 1, maxLength: 20 }),
  { minLength: 2, maxLength: 20 }
).filter(names => new Set(names).size === names.length);

describe('generarFixture — Property 3: complete round-robin coverage', () => {
  it('returns exactly N*(N-1)/2 matchups for N distinct teams', () => {
    fc.assert(
      fc.property(distinctTeamNames, (nombres) => {
        const N = nombres.length;
        const result = generarFixture(nombres);
        return result.length === (N * (N - 1)) / 2;
      }),
      { numRuns: 100 }
    );
  });

  it('every unordered pair appears exactly once in the output', () => {
    fc.assert(
      fc.property(distinctTeamNames, (nombres) => {
        const result = generarFixture(nombres);

        // Build a set of all expected unordered pairs
        const expected = new Set();
        for (let i = 0; i < nombres.length; i++) {
          for (let j = i + 1; j < nombres.length; j++) {
            expected.add([nombres[i], nombres[j]].sort().join('|||'));
          }
        }

        // Build a map of actual pairs from the output
        const seen = new Map();
        for (const matchup of result) {
          const key = [matchup.local, matchup.visitante].sort().join('|||');
          seen.set(key, (seen.get(key) ?? 0) + 1);
        }

        // Every expected pair must appear exactly once
        for (const key of expected) {
          if (seen.get(key) !== 1) return false;
        }

        // No extra pairs beyond the expected set
        if (seen.size !== expected.size) return false;

        return true;
      }),
      { numRuns: 100 }
    );
  });

  it('each matchup has exactly the fields `local` and `visitante`', () => {
    fc.assert(
      fc.property(distinctTeamNames, (nombres) => {
        const result = generarFixture(nombres);
        return result.every((matchup) => {
          const keys = Object.keys(matchup);
          return (
            keys.length === 2 &&
            keys.includes('local') &&
            keys.includes('visitante') &&
            typeof matchup.local === 'string' &&
            typeof matchup.visitante === 'string'
          );
        });
      }),
      { numRuns: 100 }
    );
  });
});
