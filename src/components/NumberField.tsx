import { useState } from 'react';

import { parseWholeNumber } from '@/lib/kit';
import { formatBRL, parseBRL, type Cents } from '@/lib/money';

import { TextField } from './TextField';

type Base = { label: string; hint?: string; placeholder?: string; error?: string };

/**
 * Campo de número inteiro (fichas, minutos, quantidades). Guarda o texto digitado e avisa o número
 * (ou null se estiver vazio/inválido). Para trocar o valor de fora, mude a `key` do componente.
 */
export function NumberField({
  value,
  onChange,
  ...rest
}: Base & { value: number | null; onChange: (value: number | null) => void }) {
  const [text, setText] = useState(value === null ? '' : String(value));
  return (
    <TextField
      {...rest}
      value={text}
      keyboardType="number-pad"
      onChangeText={(next) => {
        setText(next);
        onChange(parseWholeNumber(next));
      }}
    />
  );
}

/** Campo de dinheiro em reais ("50", "12,50"); avisa o valor em centavos (ou null). */
export function MoneyField({
  value,
  onChange,
  ...rest
}: Base & { value: Cents | null; onChange: (value: Cents | null) => void }) {
  const [text, setText] = useState(value === null ? '' : formatBRL(value).replace('R$ ', '').replace(/\./g, ''));
  return (
    <TextField
      {...rest}
      value={text}
      keyboardType="decimal-pad"
      onChangeText={(next) => {
        setText(next);
        onChange(parseBRL(next));
      }}
    />
  );
}
