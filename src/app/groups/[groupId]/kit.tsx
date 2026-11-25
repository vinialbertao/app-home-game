import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, Card, EmptyState, FormMessage, LoadingState, Screen } from '@/components';
import {
  formatChipValue,
  KIT_PRESETS,
  totalChips,
  totalValue,
  validateKitRows,
  type Denomination,
  type KitRowInput,
} from '@/lib/kit';
import { useGroup } from '@/services/groups';
import { useGroupKit, useSaveGroupKit, type GroupKit } from '@/services/kits';
import { colors, minTouchSize, radius, spacing, typography } from '@/theme';

function toRows(denominations: Denomination[]): KitRowInput[] {
  return denominations.map((d) => ({ color: d.color, value: String(d.value), quantity: String(d.quantity) }));
}

/** Kit de fichas do grupo. O admin edita; os outros só veem. */
export default function KitScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const group = useGroup(groupId);
  const kit = useGroupKit(groupId, group.data?.defaultKitId);

  if (!group.data || kit.data === undefined) {
    return (
      <Screen>
        <LoadingState error={group.error ?? kit.error} onRetry={() => kit.refetch()} />
      </Screen>
    );
  }

  const isAdmin = group.data.role === 'admin';

  if (!isAdmin) {
    return (
      <Screen>
        {kit.data ? (
          <>
            <KitSummary denominations={kit.data.denominations} />
            {kit.data.denominations.map((d) => (
              <Card key={d.id}>
                <View style={styles.viewRow}>
                  <AppText variant="label" style={styles.flex}>
                    {d.color}
                  </AppText>
                  <AppText variant="number">{formatChipValue(d.value)}</AppText>
                  <AppText variant="caption">× {d.quantity}</AppText>
                </View>
              </Card>
            ))}
          </>
        ) : (
          <EmptyState title="Sem kit ainda" message="O admin do grupo ainda não cadastrou o kit de fichas." />
        )}
      </Screen>
    );
  }

  return <KitEditor key={groupId} groupId={groupId} kit={kit.data} />;
}

function KitEditor({ groupId, kit }: { groupId: string; kit: GroupKit | null }) {
  const saveKit = useSaveGroupKit(groupId);
  const [rows, setRows] = useState<KitRowInput[]>(() => (kit ? toRows(kit.denominations) : []));
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'success' } | null>(null);

  const validation = validateKitRows(rows);
  const preview = validation.ok ? validation.denominations : null;

  function updateRow(index: number, field: keyof KitRowInput, value: string) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setMessage(null);
  }

  function save() {
    const result = validateKitRows(rows);
    if (!result.ok) return setMessage({ text: result.errors.join('\n'), tone: 'error' });
    saveKit.mutate(
      { current: kit, denominations: result.denominations },
      {
        onSuccess: () => setMessage({ text: 'Kit salvo.', tone: 'success' }),
        onError: (e) => setMessage({ text: e.message, tone: 'error' }),
      },
    );
  }

  return (
    <Screen footer={<Button title="Salvar kit" onPress={save} loading={saveKit.isPending} />}>
      <AppText muted>
        Cada cor tem um valor de face (25, 100, 500…) e a quantidade de fichas da maleta. No torneio o valor é em
        pontos; no cash, o app converte para reais pelo buy-in de cada jogo.
      </AppText>

      {rows.length === 0 ? (
        <View style={styles.presets}>
          <AppText variant="heading">Começar por uma sugestão</AppText>
          {KIT_PRESETS.map((preset) => (
            <Button
              key={preset.id}
              title={preset.label}
              variant="secondary"
              onPress={() => setRows(toRows(preset.denominations))}
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
              Valor
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
                placeholder="25"
                placeholderTextColor={colors.textFaint}
                keyboardType="number-pad"
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
          {preview ? <KitSummary denominations={preview} /> : null}
        </>
      )}

      <FormMessage message={message?.text} tone={message?.tone} />
    </Screen>
  );
}

function KitSummary({ denominations }: { denominations: Denomination[] }) {
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
          Valor total do kit
        </AppText>
        <AppText variant="number" style={styles.gold}>
          {formatChipValue(totalValue(denominations))}
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
