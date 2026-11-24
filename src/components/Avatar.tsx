import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { colors } from '@/theme';

import { AppText } from './AppText';

type Props = {
  name: string;
  /** URL da foto. Sem foto, mostra as iniciais. */
  photoUrl?: string | null;
  size?: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

/** Foto do jogador, redonda, com borda dourada. */
export function Avatar({ name, photoUrl, size = 96 }: Props) {
  const shape = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View
      style={[styles.ring, { borderRadius: size / 2 + 3 }]}
      accessibilityRole="image"
      accessibilityLabel={`Foto de ${name}`}
    >
      {photoUrl ? (
        <Image source={photoUrl} style={shape} contentFit="cover" />
      ) : (
        <View style={[styles.fallback, shape]}>
          <AppText style={[styles.initials, { fontSize: size * 0.36, lineHeight: size * 0.44 }]}>
            {initials(name)}
          </AppText>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { padding: 3, borderWidth: 2, borderColor: colors.gold },
  fallback: { backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  initials: { color: colors.gold, fontWeight: '700' },
});
