import { Pressable, StyleSheet, View } from 'react-native';

import { colors, minTouchSize, radius, spacing } from '@/theme';

import { AppText } from './AppText';

/** Linha com caixinha de marcar (ex.: quem vai jogar). */
export function CheckRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={[styles.row, checked && styles.rowOn]}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <AppText style={styles.tick}>✓</AppText> : null}
      </View>
      <AppText variant="label">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: minTouchSize,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  rowOn: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.onPrimary, fontWeight: '700' },
});
