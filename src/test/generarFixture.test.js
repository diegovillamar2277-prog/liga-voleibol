// Feature: react-migration
// Unit tests for generarFixture — Requirements 7.7, 7.8

import { describe, it, expect } from 'vitest';
import { generarFixture } from '../utils/generarFixture.js';

describe('generarFixture', () => {
  it('2 teams → 1 matchup', () => {
    const result = generarFixture(['Equipo A', 'Equipo B']);
    expect(result).toHaveLength(1);
  });

  it('3 teams → 3 matchups', () => {
    const result = generarFixture(['Equipo A', 'Equipo B', 'Equipo C']);
    expect(result).toHaveLength(3);
  });

  it('each matchup has exactly local and visitante fields', () => {
    const result = generarFixture(['Equipo A', 'Equipo B', 'Equipo C']);
    for (const matchup of result) {
      const keys = Object.keys(matchup);
      expect(keys).toHaveLength(2);
      expect(keys).toContain('local');
      expect(keys).toContain('visitante');
    }
  });

  it('matchup values are strings from the input array', () => {
    const teams = ['Equipo A', 'Equipo B', 'Equipo C'];
    const result = generarFixture(teams);
    for (const matchup of result) {
      expect(teams).toContain(matchup.local);
      expect(teams).toContain(matchup.visitante);
    }
  });
});
