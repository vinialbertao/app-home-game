import { Platform, type TextStyle } from 'react-native';

/**
 * Tema único do app (sempre escuro: o jogo acontece à noite, com luz baixa).
 * Verde de feltro para ações, dourado para dinheiro e destaque.
 * Nenhuma tela usa cor solta: tudo sai daqui.
 */
export const colors = {
  background: '#0B1410',
  surface: '#13201A',
  surfaceRaised: '#1B2C24',
  border: '#2A3D33',

  text: '#F1F5F2',
  textMuted: '#9DB0A6',
  textFaint: '#66796F',

  primary: '#2EA36B',
  primaryPressed: '#258456',
  onPrimary: '#04140C',

  gold: '#E5B84B',
  danger: '#E5534B',
  warning: '#E8A13A',
  success: '#3FBF7F',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

/** Fonte do sistema (SF no iPhone, Roboto no Android): nada para carregar no Expo Go. */
const fontFamily = Platform.select({ web: 'system-ui, sans-serif', default: undefined });

const base: TextStyle = { fontFamily, color: colors.text };

export const typography = {
  title: { ...base, fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { ...base, fontSize: 20, lineHeight: 26, fontWeight: '600' },
  body: { ...base, fontSize: 16, lineHeight: 22, fontWeight: '400' },
  label: { ...base, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  caption: { ...base, fontSize: 13, lineHeight: 18, fontWeight: '400', color: colors.textMuted },
  /** Valores em R$, fichas e timer: algarismos de largura fixa para não “pular”. */
  number: { ...base, fontSize: 18, lineHeight: 24, fontWeight: '600', fontVariant: ['tabular-nums'] },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

/** Área mínima de toque (Apple/Google): botões nunca menores que isso. */
export const minTouchSize = 48;
