import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

type Props = {
  children: ReactNode;
  /** Com onPress, o cartão inteiro vira um botão (ex.: um grupo na lista). */
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, onPress, accessibilityLabel, style }: Props) {
  if (!onPress) {
    return <View style={[styles.card, style]}>{children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: { backgroundColor: colors.surfaceRaised },
});
