import { describe, expect, it } from '@jest/globals';

import { normalizePlayerId } from './playerId';

describe('normalizePlayerId', () => {
  it.each([
    ['MF-7K4Q2X', 'MF-7K4Q2X'],
    ['mf-7k4q2x', 'MF-7K4Q2X'],
    ['7K4Q2X', 'MF-7K4Q2X'],
    [' MF 7K4Q2X ', 'MF-7K4Q2X'],
    ['MF7K4Q2X', 'MF-7K4Q2X'],
  ])('"%s" → %s', (input, expected) => {
    expect(normalizePlayerId(input)).toBe(expected);
  });

  it.each(['', 'MF-7K4Q2', 'MF-7K4Q2XX', 'MF-0K4Q2X', 'MF-IK4Q2X', 'XX-7K4Q2X'])('"%s" é inválido', (input) => {
    expect(normalizePlayerId(input)).toBeNull();
  });
});
