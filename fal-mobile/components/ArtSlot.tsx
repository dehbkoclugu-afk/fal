import React from 'react';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';

import { artwork, type ArtId } from '@/lib/artAssets';

type ArtSlotProps = {
  id: ArtId;
  strength?: 'soft' | 'card' | 'strong';
};

/**
 * Full-frame art layer. The image itself is never shifted or narrowed: this
 * avoids the Android cover/crop regression seen in earlier art-slot systems.
 * A flat veil protects copy without creating a grey gradient wall.
 */
export function ArtSlot({ id, strength = 'card' }: ArtSlotProps) {
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const alpha = {
    soft: scheme === 'light' ? 0.32 : 0.22,
    card: scheme === 'light' ? 0.48 : 0.36,
    strong: scheme === 'light' ? 0.58 : 0.48,
  }[strength];

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={artwork[id][scheme]} resizeMode="cover" style={styles.image} />
      <View style={[styles.veil, { backgroundColor: `rgba(22, 16, 14, ${alpha})` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  veil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
