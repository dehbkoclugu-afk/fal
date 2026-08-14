import React from 'react';
import { Image, StyleSheet, useColorScheme, View } from 'react-native';

import { semanticArtwork, type ArtId, type SemanticArt } from '@/lib/artAssets';

type ArtSlotProps = {
  id?: ArtId;
  art?: SemanticArt;
  strength?: 'soft' | 'card' | 'strong';
  selected?: boolean;
  contentSide?: 'left' | 'right';
};

/**
 * Full-frame art layer. The image itself is never shifted or narrowed: this
 * avoids the Android cover/crop regression seen in earlier art-slot systems.
 * A flat veil protects copy without creating a grey gradient wall.
 */
export function ArtSlot({ id, art, strength = 'card', selected = false, contentSide }: ArtSlotProps) {
  const scheme = useColorScheme() === 'light' ? 'light' : 'dark';
  const resolved = art ?? (id ? semanticArtwork[id] : undefined);
  if (!resolved) throw new Error('ArtSlot için id veya art gerekli');
  const baseAlpha = {
    soft: scheme === 'light' ? 0.38 : 0.30,
    card: scheme === 'light' ? 0.58 : 0.55,
    strong: scheme === 'light' ? 0.70 : 0.68,
  }[strength];
  const alpha = selected ? Math.max(0.18, baseAlpha - 0.16) : baseAlpha;
  const subjectSide = contentSide ?? resolved.safeSide;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Image source={resolved[scheme]} resizeMode="cover" style={[styles.image, subjectSide === 'right' && styles.imageRight]} />
      <View style={[styles.veil, { backgroundColor: `rgba(22, 16, 14, ${alpha})` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  imageRight: { transform: [{ scaleX: -1 }] },
  veil: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
});
