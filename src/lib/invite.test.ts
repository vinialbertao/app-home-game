import { describe, expect, it } from '@jest/globals';

import { buildInviteMessage, extractInviteCode, formatInviteCode, normalizeInviteCode } from './invite';

describe('normalizeInviteCode', () => {
  it.each([
    ['ABCD2345', 'ABCD2345'],
    ['abcd-2345', 'ABCD2345'],
    [' ABCD 2345 ', 'ABCD2345'],
  ])('"%s" → %s', (input, expected) => {
    expect(normalizeInviteCode(input)).toBe(expected);
  });

  it.each(['', 'ABC2345', 'ABCD23456', 'ABCD0345', 'ABCD1345', 'OBCD2345', 'IBCD2345'])('"%s" é inválido', (input) => {
    expect(normalizeInviteCode(input)).toBeNull();
  });
});

describe('extractInviteCode', () => {
  it('acha o código dentro da mensagem do convite', () => {
    const message = buildInviteMessage('Poker de quinta', 'K7MQ2XPA');
    expect(extractInviteCode(message)).toBe('K7MQ2XPA');
  });

  it('não confunde palavra do nome do grupo com o código', () => {
    const message = buildInviteMessage('CASCAVEL Poker', 'K7MQ2XPA');
    expect(extractInviteCode(message)).toBe('K7MQ2XPA');
  });

  it('aceita o código puro', () => {
    expect(extractInviteCode('k7mq2xpa')).toBe('K7MQ2XPA');
  });

  it('devolve null quando não há código', () => {
    expect(extractInviteCode('oi, bora jogar?')).toBeNull();
  });
});

describe('formatInviteCode e mensagem', () => {
  it('separa em dois blocos', () => {
    expect(formatInviteCode('K7MQ2XPA')).toBe('K7MQ-2XPA');
  });

  it('a mensagem leva o nome do grupo e o código formatado', () => {
    const message = buildInviteMessage('Turma da firma', 'K7MQ2XPA');
    expect(message).toContain('"Turma da firma"');
    expect(message).toContain('K7MQ-2XPA');
  });
});
