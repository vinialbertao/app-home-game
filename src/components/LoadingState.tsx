import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme';

import { AppText } from './AppText';
import { Button } from './Button';

type Props = {
  /** Erro da consulta: mostra a mensagem e o botão "Tentar de novo". */
  error?: unknown;
  onRetry?: () => void;
};

/** Carregando… ou erro com "Tentar de novo". Usado enquanto os dados chegam do servidor. */
export function LoadingState({ error, onRetry }: Props) {
  if (error) {
    return (
      <View style={styles.container}>
        <AppText variant="heading" style={styles.center}>
          Não deu para carregar
        </AppText>
        <AppText muted style={styles.center}>
          Confira a internet e tente de novo.
        </AppText>
        {onRetry ? <Button title="Tentar de novo" variant="secondary" onPress={onRetry} /> : null}
      </View>
    );
  }
  return (
    <View style={styles.container} accessibilityLabel="Carregando">
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingVertical: spacing.xxl, gap: spacing.md, alignItems: 'stretch' },
  center: { textAlign: 'center' },
});
