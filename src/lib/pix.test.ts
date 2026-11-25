import { describe, expect, it } from '@jest/globals';

import { buildPixPayload, crc16, normalizePixKey } from './pix';

describe('crc16', () => {
  it('valor de conferência padrão do CRC-16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1');
  });

  it('exemplo do manual do BR Code do Banco Central', () => {
    const body =
      '00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000' +
      '5204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304';
    expect(crc16(body)).toBe('1D3D');
  });
});

describe('normalizePixKey', () => {
  it.each([
    ['529.982.247-25', { type: 'cpf', key: '52998224725' }],
    ['11.222.333/0001-81', { type: 'cnpj', key: '11222333000181' }],
    ['(19) 99876-5432', { type: 'phone', key: '+5519998765432' }],
    ['+55 19 99876-5432', { type: 'phone', key: '+5519998765432' }],
    ['Vini@Email.com', { type: 'email', key: 'vini@email.com' }],
    ['123E4567-E12B-12D1-A456-426655440000', { type: 'random', key: '123e4567-e12b-12d1-a456-426655440000' }],
  ])('"%s"', (input, expected) => {
    expect(normalizePixKey(input)).toEqual(expected);
  });

  it.each(['', 'abc', '123.456.789-00', '1234', '(19) 3234-5678'])('"%s" não é chave válida', (input) => {
    expect(normalizePixKey(input)).toBeNull();
  });
});

describe('buildPixPayload', () => {
  const key = { type: 'email' as const, key: 'vini@email.com' };

  it('monta o copia e cola com valor e CRC no fim', () => {
    const payload = buildPixPayload({ key, receiverName: 'Vinícius Albertão', amountCents: 2950 });
    const body =
      '000201' + // versão
      '26360014br.gov.bcb.pix0114vini@email.com' + // chave
      '52040000' + // categoria
      '5303986' + // moeda (real)
      '540529.50' + // valor
      '5802BR' + // país
      '5917VINICIUS ALBERTAO' + // nome sem acento
      '6006BRASIL' + // cidade
      '62070503***' + // identificador
      '6304'; // CRC a seguir
    expect(payload).toBe(body + crc16(body));
  });

  it('valor com centavos e reais grandes', () => {
    expect(buildPixPayload({ key, receiverName: 'A', amountCents: 5 })).toContain('54040.05');
    expect(buildPixPayload({ key, receiverName: 'A', amountCents: 123456 })).toContain('54071234.56');
  });

  it('sem valor não leva o campo 54', () => {
    expect(buildPixPayload({ key, receiverName: 'A' })).not.toContain('5404');
  });

  it('nome longo é cortado em 25 letras', () => {
    const payload = buildPixPayload({ key, receiverName: 'Maria Aparecida da Silva Santos Oliveira', amountCents: 100 });
    expect(payload).toContain('5924MARIA APARECIDA DA SILVA6006');
  });

  it('o CRC do próprio payload confere', () => {
    const payload = buildPixPayload({ key, receiverName: 'Edu', amountCents: 2950 });
    expect(crc16(payload.slice(0, -4))).toBe(payload.slice(-4));
  });
});
