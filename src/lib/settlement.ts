/**
 * Acerto de contas: a partir de quanto cada um ganhou ou perdeu, monta a lista de Pix.
 * Regras: centavos inteiros, a soma tem que dar zero, e o número de transferências é o menor
 * que a regra abaixo consegue (no máximo jogadores com saldo − 1; costuma ser bem menos).
 */
import { assertCents, type Cents } from './money';

export type Balance = { playerId: string; net: Cents };
export type Transfer = { from: string; to: string; amountCents: Cents };

export class SettlementError extends Error {}

export function settle(balances: Balance[]): Transfer[] {
  for (const b of balances) assertCents(b.net);
  const total = balances.reduce((s, b) => s + b.net, 0);
  if (total !== 0) {
    throw new SettlementError(`Os saldos não fecham: sobram ${total} centavos. Confira a contagem.`);
  }

  const transfers: Transfer[] = [];
  // Quem deve (net < 0) e quem recebe (net > 0), com o valor ainda em aberto
  const debtors = balances.filter((b) => b.net < 0).map((b) => ({ id: b.playerId, open: -b.net }));
  const creditors = balances.filter((b) => b.net > 0).map((b) => ({ id: b.playerId, open: b.net }));

  // 1º: pares que se resolvem com um Pix só (quem deve exatamente o que outro tem a receber)
  for (const debtor of debtors) {
    const match = creditors.find((c) => c.open > 0 && c.open === debtor.open);
    if (match) {
      transfers.push({ from: debtor.id, to: match.id, amountCents: debtor.open });
      match.open = 0;
      debtor.open = 0;
    }
  }

  // 2º: o maior devedor paga o maior credor, até zerar todo mundo
  for (;;) {
    const debtor = debtors.filter((d) => d.open > 0).sort((a, b) => b.open - a.open || a.id.localeCompare(b.id))[0];
    const creditor = creditors.filter((c) => c.open > 0).sort((a, b) => b.open - a.open || a.id.localeCompare(b.id))[0];
    if (!debtor || !creditor) break;
    const amount = Math.min(debtor.open, creditor.open);
    transfers.push({ from: debtor.id, to: creditor.id, amountCents: amount });
    debtor.open -= amount;
    creditor.open -= amount;
  }

  return transfers;
}

/** Saldo final de cada um depois das transferências (para conferir: tem que dar zero para todos). */
export function applyTransfers(balances: Balance[], transfers: Transfer[]): Map<string, Cents> {
  const result = new Map(balances.map((b) => [b.playerId, b.net]));
  for (const t of transfers) {
    result.set(t.from, (result.get(t.from) ?? 0) + t.amountCents);
    result.set(t.to, (result.get(t.to) ?? 0) - t.amountCents);
  }
  return result;
}
