/**
 * Pix "copia e cola" / QR code estático com valor (padrão BR Code do Banco Central, formato EMV).
 * Monta o texto que vira o QR code; qualquer app de banco lê e já preenche chave e valor.
 */
import type { Cents } from './money';

export type PixKeyType = 'cpf' | 'cnpj' | 'phone' | 'email' | 'random';
export type PixKey = { type: PixKeyType; key: string };

function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (length: number) => {
    let total = 0;
    for (let i = 0; i < length; i++) total += Number(digits[i]) * (length + 1 - i);
    const rest = (total * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

function isValidCnpj(digits: string): boolean {
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  const calc = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const total = weights.reduce((s, w, i) => s + w * Number(digits[i]), 0);
    const rest = total % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return calc(12) === Number(digits[12]) && calc(13) === Number(digits[13]);
}

/**
 * Reconhece a chave como a pessoa costuma digitar e deixa no formato que o Pix exige:
 * CPF/CNPJ só números, celular com +55, e-mail minúsculo, chave aleatória minúscula.
 */
export function normalizePixKey(input: string): PixKey | null {
  const raw = input.trim();
  if (!raw) return null;

  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
    return { type: 'random', key: raw.toLowerCase() };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return { type: 'email', key: raw.toLowerCase() };

  const digits = raw.replace(/\D/g, '');
  const hasPlus = raw.startsWith('+');

  if (!hasPlus && digits.length === 11 && isValidCpf(digits)) return { type: 'cpf', key: digits };
  if (!hasPlus && digits.length === 14 && isValidCnpj(digits)) return { type: 'cnpj', key: digits };

  // Celular: DDD + 9 + 8 dígitos, com ou sem 55 na frente
  const phone = digits.startsWith('55') && digits.length === 13 ? digits.slice(2) : digits;
  if (/^[1-9]{2}9\d{8}$/.test(phone)) return { type: 'phone', key: `+55${phone}` };

  return null;
}

export function describePixKey(key: PixKey): string {
  const labels: Record<PixKeyType, string> = {
    cpf: 'CPF',
    cnpj: 'CNPJ',
    phone: 'Celular',
    email: 'E-mail',
    random: 'Chave aleatória',
  };
  return labels[key.type];
}

/** CRC16-CCITT (polinômio 0x1021, começo 0xFFFF), como o BR Code pede. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function field(id: string, value: string): string {
  return `${id}${String(value.length).padStart(2, '0')}${value}`;
}

/** Sem acentos e só caracteres simples (o padrão aceita ASCII). */
function plain(text: string, maxLength: number): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .toUpperCase()
    .slice(0, maxLength)
    .trim();
}

type PixPayloadInput = {
  key: PixKey;
  /** nome de quem recebe (até 25 letras) */
  receiverName: string;
  /** cidade de quem recebe (até 15 letras); o app usa "BRASIL" quando não sabe */
  city?: string;
  amountCents?: Cents;
  /** identificador da cobrança; "***" quando não há */
  txid?: string;
};

/** Texto do Pix copia e cola (é o mesmo conteúdo do QR code). */
export function buildPixPayload({ key, receiverName, city = 'BRASIL', amountCents, txid = '***' }: PixPayloadInput): string {
  const merchantAccount = field('00', 'br.gov.bcb.pix') + field('01', key.key);
  const name = plain(receiverName, 25) || 'RECEBEDOR';
  const cityName = plain(city, 15) || 'BRASIL';
  const cleanTxid = txid === '***' ? txid : txid.replace(/[^A-Za-z0-9]/g, '').slice(0, 25) || '***';

  let payload =
    field('00', '01') +
    field('26', merchantAccount) +
    field('52', '0000') +
    field('53', '986') +
    (amountCents && amountCents > 0 ? field('54', (amountCents / 100).toFixed(2)) : '') +
    field('58', 'BR') +
    field('59', name) +
    field('60', cityName) +
    field('62', field('05', cleanTxid));

  payload += '6304';
  return payload + crc16(payload);
}
