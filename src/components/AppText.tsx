import { Text, type TextProps } from 'react-native';

import { colors, typography, type TypographyVariant } from '@/theme';

type Props = TextProps & {
  variant?: TypographyVariant;
  muted?: boolean;
};

/** Texto do app. Sempre use este em vez do <Text> do React Native. */
export function AppText({ variant = 'body', muted, style, ...rest }: Props) {
  return (
    <Text style={[typography[variant], muted && { color: colors.textMuted }, style]} {...rest} />
  );
}
