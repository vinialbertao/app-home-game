import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, EmptyState, FormMessage, LoadingState, Screen } from '@/components';
import {
  formatChipValue,
  formatKitValue,
  KIT_PRESETS,
  kitValueToInput,
  totalChips,
  totalValue,
  validateKitRows,
  type Denomination,
  type KitKind,
  type KitRowInput,
} from '@/lib/kit';
import { formatBRL } from '@/lib/money';
import { useGroup } from '@/services/groups';
import { useGroupKit, useSaveGroupKit, type GroupKit } from '@/services/kits';
import { colors, minTouchSize, radius, spacing, typography } from '@/theme';

function toRows(denominations: Denomination[], kind: KitKind): KitRowInput[] {
  return denominations.map((d) => ({
    color: d.color,
    value: kitValueToInput(d.value, kind),
    quantity: String(d.quantity),
  }));
}

const TITLES: Record<KitKind, string> = { cash: 'Kit do cash', tournament: 'Kit do torneio' };

/** Kit de fichas do grupo (?kind=cash ou tournament). O admin edita; os outros só veem. */
export default function KitScreen() {
  const { groupId, kind: kindParam } = useLocalSearchParams<{ groupId: string; kind?: string }>();
  const kind: KitKind = kindParam === 'cash' ? 'cash' : 'tournament';
  const group = useGroup(groupId);
  const kitId = group.data ? (kind === 'cash' ? group.data.cashKitId : group.data.tournamentKitId) : undefined;
  const kit = useGroupKit(groupId, kind, kitId);

  if (!group.data || kit.data === undefined) {
    return (
      <Screen>
        <Stack.Screen options={{ title: TITLES[kind] }} />
        <LoadingState error={group.error ?? kit.error} onRetry={() => kit.refetch()} />
      </Screen>
    );
  }

  if (group.data.role !== 'admin') {
    return (
      <Screen>
        <Stack.Screen options={{ title: TITLES[kind] }} />
        {kit.data ? (
          <>
            <KitSummary denominations={kit.data.denominations} kind={kind} />
            {kit.data.denominations.map((d) => (
              <Card key={d.id}>
                <View style={styles.viewRow}>
                  <AppText variant="label" style={styles.flex}>
                    {d.color}
                  </AppText>
                  <AppText variant="number">{formatKitValue(d.value, kind)}</AppText>
                  <AppText variant="caption">× {d.quantity}</AppText>
                </View>
              </Card>
            ))}
          </>
        ) : (
          <EmptyState title="Sem kit ainda" message="O admin do grupo ainda não cadastrou este kit." />
        )}
      </Screen>
    );
  }

  return <KitEditor key={`${groupId}-${kind}`} groupId={groupId} kind={kind} kit={kit.data} />;
}

function KitEditor({ groupId, kind, kit }: { groupId: string; kind: KitKind; kit: GroupKit | null }) {
  const saveKit = useSaveGroupKit(groupId, kind);
  const [rows, setRows] = useState<KitRowInput[]>(() => (kit ? toRows(kit.denominations, kind) : []));
  const [message, setMessage] = useState<string | null>(null);

  const validation = validateKitRows(rows, kind);
  const preview = validation.ok ? validation.denominations : null;

  function updateRow(index: number, field: keyof KitRowInput, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setMessage(null);
  }

  function save() {
    const result = validateKitRows(rows, kind);
    if (!result.ok) return setMessage(result.errors.join('\n'));
    saveKit.mutate(
      { current: kit, denominations: result.denominations },
      // Volta para a tela do grupo, que já mostra o resumo do kit atualizado
      { onSuccess: () => router.back(), onError: (e) => setMessage(e.message) },
    );
  }

  return (
    <Screen footer={<Button title="Salvar kit" onPress={save} loading={saveKit.isPending} />}>
      <Stack.Screen options={{ title: TITLES[kind] }} />
      <AppText muted>
        {kind === 'cash'
          ? 'No cash a ficha é dinheiro: cadastre quanto vale cada cor em reais (ex.: 0,50 · 1 · 5 · 10).'
          : 'No torneio a ficha vale pontos (25, 100, 500…). Os blinds e o stack inicial usam esses valores.'}
      </AppText>

      {rows.length === 0 ? (
        <View style={styles.presets}>
          <AppText variant="heading">Começar por uma sugestão</AppText>
          {KIT_PRESETS[kind].map((preset) => (
            <Button
              key={preset.id}
              title={preset.label}
              variant="secondary"
              onPress={() => setRows(toRows(preset.denominations, kind))}
            />
          ))}
          <Button
            title="Começar do zero"
            variant="ghost"
            onPress={() => setRows([{ color: '', value: '', quantity: '' }])}
          />
        </View>
      ) : (
        <>
          <View style={styles.headerRow}>
            <AppText variant="caption" style={styles.colorCol}>
              Cor
            </AppText>
            <AppText variant="caption" style={styles.numberCol}>
              {kind === 'cash' ? 'Valor (R$)' : 'Valor'}
            </AppText>
            <AppText variant="caption" style={styles.numberCol}>
              Qtd.
            </AppText>
            <View style={styles.removeCol} />
          </View>
          {rows.map((row, index) => (
            <View key={index} style={styles.editRow}>
              <TextInput
                style={[styles.input, styles.colorCol]}
                value={row.color}
                onChangeText={(text) => updateRow(index, 'color', text)}
                placeholder="Cor"
                placeholderTextColor={colors.textFaint}
                accessibilityLabel={`Cor da linha ${index + 1}`}
                maxLength={30}
                keyboardAppearance="dark"
              />
              <TextInput
                style={[styles.input, styles.numberCol]}
                value={row.value}
                onChangeText={(text) => updateRow(index, 'value', text)}
                placeholder={kind === 'cash' ? '0,50' : '25'}
                placeholderTextColor={colors.textFaint}
                keyboardType={kind === 'cash' ? 'decimal-pad' : 'number-pad'}
                accessibilityLabel={`Valor da linha ${index + 1}`}
                keyboardAppearance="dark"
              />
              <TextInput
                style={[styles.input, styles.numberCol]}
                value={row.quantity}
                onChangeText={(text) => updateRow(index, 'quantity', text)}
                placeholder="100"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
                accessibilityLabel={`Quantidade da linha ${index + 1}`}
                keyboardAppearance="dark"
              />
              <View style={styles.removeCol}>
                <Button
                  title="✕"
                  variant="ghost"
                  compact
                  accessibilityLabel={`Remover linha ${index + 1}`}
                  onPress={() => setRows((current) => current.filter((_, i) => i !== index))}
                />
              </View>
            </View>
          ))}
          <Button
            title="Adicionar cor"
            variant="secondary"
            onPress={() => setRows((current) => [...current, { color: '', value: '', quantity: '' }])}
          />
          {preview ? <KitSummary denominations={preview} kind={kind} /> : null}
        </>
      )}

      <FormMessage message={message} />
    </Screen>
  );
}

function KitSummary({ denominations, kind }: { denominations: Denomination[]; kind: KitKind }) {
  const value = totalValue(denominations);
  return (
    <Card>
      <View style={styles.viewRow}>
        <AppText variant="caption" style={styles.flex}>
          Total de fichas
        </AppText>
        <AppText variant="number">{formatChipValue(totalChips(denominations))}</AppText>
      </View>
      <View style={styles.viewRow}>
        <AppText variant="caption" style={styles.flex}>
          {kind === 'cash' ? 'Dinheiro que o kit cobre' : 'Valor total do kit'}
        </AppText>
        <AppText variant="number" style={styles.gold}>
          {kind === 'cash' ? formatBRL(value) : formatChipValue(value)}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  presets: { gap: spacing.sm },
  headerRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.xs },
  editRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  viewRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  colorCol: { flex: 2 },
  numberCol: { flex: 1 },
  removeCol: { width: minTouchSize },
  flex: { flex: 1 },
  gold: { color: colors.gold },
  input: {
    ...typography.body,
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
});
