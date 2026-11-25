import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

type Props = {
  message: string | null | undefined;
  tone?: 'error' | 'success';
};

/** Caixa de aviso de formulário (erro do servidor, "salvo!"). Some quando não há mensagem. */
export function FormMessage({ message, tone = 'error' }: Props) {
  if (!message) return null;
  const color = tone === 'error' ? colors.danger : colors.success;
  return (
    <View
      style={[styles.box, { borderColor: color }]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <AppText style={{ color }}>{message}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
});
