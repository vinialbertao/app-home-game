import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { colors, minTouchSize, radius, spacing, typography } from '@/theme';

import { AppText } from './AppText';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: Variant;
  loading?: boolean;
};

export function Button({ title, variant = 'primary', loading, disabled, ...rest }: Props) {
  const isDisabled = disabled || loading;
  const textColor = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.danger : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        pressed && (variant === 'primary' ? styles.primaryPressed : styles.pressed),
        isDisabled && styles.disabled,
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <AppText style={[typography.label, styles.title, { color: textColor }]}>{title}</AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: minTouchSize,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  primaryPressed: { backgroundColor: colors.primaryPressed },
  secondary: { backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.danger },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.45 },
  title: { fontSize: 16 },
});
