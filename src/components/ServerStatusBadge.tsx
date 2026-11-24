import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { checkServerConnection, type ServerStatus } from '@/services/supabase';
import { colors, radius, spacing } from '@/theme';

import { AppText } from './AppText';

const labels: Record<ServerStatus | 'checking', string> = {
  checking: 'Conectando ao servidor…',
  connected: 'Conectado ao servidor',
  'not-configured': 'Servidor não configurado (.env)',
  offline: 'Sem conexão com o servidor',
};

/** Aviso discreto de que o app está falando com o Supabase. */
export function ServerStatusBadge() {
  const [status, setStatus] = useState<ServerStatus | 'checking'>('checking');

  useEffect(() => {
    let active = true;
    checkServerConnection().then((result) => {
      if (active) setStatus(result);
    });
    return () => {
      active = false;
    };
  }, []);

  const dotColor =
    status === 'connected' ? colors.success : status === 'checking' ? colors.textFaint : colors.warning;

  return (
    <View style={styles.badge} accessibilityRole="text" accessibilityLabel={labels[status]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <AppText variant="caption">{labels[status]}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
