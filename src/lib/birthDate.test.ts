import { describe, expect, it } from '@jest/globals';

import { ageOn, checkBirthDate, maskBirthDateInput, parseBirthDate, todayIso } from './birthDate';

describe('maskBirthDateInput', () => {
  it.each([
    ['', ''],
    ['2', '2'],
    ['251', '25/1'],
    ['2512', '25/12'],
    ['25121', '25/12/1'],
    ['25121990', '25/12/1990'],
    ['25/12/1990', '25/12/1990'],
    ['251219901234', '25/12/1990'],
    ['ab25c12', '25/12'],
  ])('"%s" → "%s"', (input, expected) => {
    expect(maskBirthDateInput(input)).toBe(expected);
  });
});

describe('parseBirthDate', () => {
  it.each([
    ['25/12/1990', '1990-12-25'],
    ['29/02/2000', '2000-02-29'],
    ['01/01/1900', '1900-01-01'],
  ])('"%s" → %s', (input, expected) => {
    expect(parseBirthDate(input)).toBe(expected);
  });

  it.each(['', '25/12/90', '31/04/1990', '29/02/2001', '00/01/1990', '10/13/1990', '01/01/1899', '1990-12-25'])(
    '"%s" é inválida',
    (input) => {
      expect(parseBirthDate(input)).toBeNull();
    },
  );
});

describe('ageOn', () => {
  it('conta só aniversário completo', () => {
    expect(ageOn('2008-11-25', '2026-11-24')).toBe(17);
    expect(ageOn('2008-11-25', '2026-11-25')).toBe(18);
    expect(ageOn('2008-12-01', '2026-11-25')).toBe(17);
  });

  it('nascido em 29/02 faz aniversário em 01/03 nos anos comuns', () => {
    expect(ageOn('2008-02-29', '2026-02-28')).toBe(17);
    expect(ageOn('2008-02-29', '2026-03-01')).toBe(18);
  });
});

describe('checkBirthDate', () => {
  const today = '2026-11-25';

  it('aceita quem faz 18 hoje', () => {
    expect(checkBirthDate('25/11/2008', today)).toEqual({ ok: true, iso: '2008-11-25' });
  });

  it('recusa quem faz 18 amanhã', () => {
    expect(checkBirthDate('26/11/2008', today).ok).toBe(false);
  });

  it('recusa data no futuro e formato errado', () => {
    expect(checkBirthDate('01/01/2030', today).ok).toBe(false);
    expect(checkBirthDate('1/1/1990', today).ok).toBe(false);
  });
});

describe('todayIso', () => {
  it('usa a data local', () => {
    expect(todayIso(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
