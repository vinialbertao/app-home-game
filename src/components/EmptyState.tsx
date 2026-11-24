import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { AppText } from './AppText';

type Props = {
  title: string;
  message?: string;
  /** Ação principal, por exemplo um <Button>. */
  action?: ReactNode;
};

/** O que aparece quando ainda não há nada (nenhum grupo, nenhum jogo). */
export function EmptyState({ title, message, action }: Props) {
  return (
    <View style={styles.container}>
      <AppText variant="heading" style={styles.center}>
        {title}
      </AppText>
      {message ? (
        <AppText muted style={styles.center}>
          {message}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'stretch', gap: spacing.md, paddingVertical: spacing.xxl },
  center: { textAlign: 'center' },
});
