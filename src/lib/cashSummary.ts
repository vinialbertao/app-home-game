/** Texto do resumo do acerto para mandar no WhatsApp. */
import type { PlayerResult } from './cash';
import { formatBRL } from './money';
import type { Transfer } from './settlement';

function signed(cents: number): string {
  if (cents > 0) return `+${formatBRL(cents)}`;
  if (cents < 0) return `-${formatBRL(-cents)}`;
  return formatBRL(0);
}

export function buildSettlementSummary(input: {
  groupName: string;
  dateLabel: string;
  results: PlayerResult[];
  transfers: Transfer[];
  nameOf: (playerId: string) => string;
}): string {
  const results = [...input.results].sort((a, b) => b.net - a.net);
  const lines = [
    `♠️ Cash — ${input.groupName} (${input.dateLabel})`,
    '',
    'Resultado:',
    ...results.map((r) => `• ${r.name}: ${signed(r.net)}`),
    '',
  ];
  if (input.transfers.length === 0) {
    lines.push('Ninguém deve nada. 🤝');
  } else {
    lines.push('Pix do acerto:');
    lines.push(
      ...input.transfers.map((t) => `• ${input.nameOf(t.from)} → ${input.nameOf(t.to)}: ${formatBRL(t.amountCents)}`),
    );
    lines.push('', 'O QR code de cada Pix está no app.');
  }
  return lines.join('\n');
}
