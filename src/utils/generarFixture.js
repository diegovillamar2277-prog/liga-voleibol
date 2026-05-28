// ============================================================
//  generarFixture.js — Pure round-robin fixture generator
//  Extracted from src/liga/liga-dashboard.js and src/liga/public-view.js
// ============================================================

/**
 * Generates all unique matchup pairs for a round-robin tournament.
 *
 * @param {string[]} nombres - Array of team names
 * @returns {{ local: string, visitante: string }[]} - Array of matchup objects,
 *   one per unique unordered pair. Length = N*(N-1)/2 for N teams.
 *
 * Pure function: no DOM access, no side effects.
 */
export function generarFixture(nombres) {
  const enc = [];
  for (let i = 0; i < nombres.length; i++)
    for (let j = i + 1; j < nombres.length; j++)
      enc.push({ local: nombres[i], visitante: nombres[j] });
  return enc;
}
