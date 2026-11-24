import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  /** Rola o conteúdo (padrão). Desligue para telas com lista própria (FlatList). */
  scroll?: boolean;
  /** Rodapé fixo, por exemplo o botão principal da tela. */
  footer?: ReactNode;
};

/** Base de toda tela: fundo, margens, área segura e teclado. */
export function Screen({ children, scroll = true, footer }: Props) {
  const content = scroll ? (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill]}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {content}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.lg,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
  footer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
  },
});
