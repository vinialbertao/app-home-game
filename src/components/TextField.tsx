import { useId, useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, minTouchSize, radius, spacing, typography } from '@/theme';

import { AppText } from './AppText';

type Props = TextInputProps & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, hint, error, style, onFocus, onBlur, ...rest }: Props) {
  const [focused, setFocused] = useState(false);
  const id = useId();

  return (
    <View style={styles.wrapper}>
      <AppText variant="label" nativeID={id}>
        {label}
      </AppText>
      <TextInput
        accessibilityLabelledBy={id}
        accessibilityLabel={label}
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.primary}
        keyboardAppearance="dark"
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          styles.input,
          focused && styles.focused,
          !!error && styles.invalid,
          style,
        ]}
        {...rest}
      />
      {error ? (
        <AppText variant="caption" style={styles.error}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="caption">{hint}</AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  input: {
    ...typography.body,
    minHeight: minTouchSize,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  focused: { borderColor: colors.primary },
  invalid: { borderColor: colors.danger },
  error: { color: colors.danger },
});
