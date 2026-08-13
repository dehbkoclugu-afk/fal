import React from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import {
  TAROT_ATLAS_COLUMNS,
  TAROT_ATLAS_ROWS,
  tarotAtlas,
  tarotCardIndex,
  type TarotCardKey,
} from '@/lib/tarotAtlas';
import { color, radius, space, type } from '@/lib/theme';
import { t } from '@/lib/i18n';

export type TarotDrawCard = { position: string; key: TarotCardKey; name_tr: string; reversed: boolean };
export type TarotDraw = { spread: string; seed: string; selections?: number[] | null; cards: TarotDrawCard[] };

function TarotFace({ card, width }: { card: TarotDrawCard; width: number }) {
  const index = tarotCardIndex(card.key);
  const column = index % TAROT_ATLAS_COLUMNS;
  const row = Math.floor(index / TAROT_ATLAS_COLUMNS);
  const height = width * (480 / 280);

  return (
    <View style={[styles.frame, card.reversed && styles.reversed, { width, height }]}>
      <Image
        source={tarotAtlas}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: width * TAROT_ATLAS_COLUMNS,
          height: height * TAROT_ATLAS_ROWS,
          left: -column * width,
          top: -row * height,
        }}
      />
    </View>
  );
}

export function TarotReveal({ draw }: { draw: TarotDraw }) {
  const { width } = useWindowDimensions();
  const cardCount = draw.cards.length;
  if (cardCount === 0) return null;

  const fitsWithoutScrolling = cardCount <= 3;
  const availableWidth = width - space.lg * 2;
  const cardWidth = cardCount === 1
    ? Math.min(220, availableWidth * 0.62)
    : fitsWithoutScrolling
      ? Math.min(128, (availableWidth - space.md * (cardCount - 1)) / cardCount)
      // Five-card spreads deliberately leave the next card peeking in from
      // the edge. That makes the horizontal gesture discoverable without an
      // always-visible platform scrollbar.
      : Math.min(112, Math.max(84, availableWidth * 0.28));

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        scrollEnabled={!fitsWithoutScrolling}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[
          styles.row,
          fitsWithoutScrolling && styles.fittedRow,
        ]}
      >
        {draw.cards.map((card) => (
          <View key={`${card.position}:${card.key}`} style={[styles.cardColumn, { width: cardWidth }]}>
            <Text style={styles.position}>{card.position}</Text>
            <View accessible accessibilityLabel={`${card.position}: ${card.name_tr}${card.reversed ? `, ${t('tarot.ters')}` : ''}`}>
              <TarotFace card={card} width={cardWidth} />
            </View>
            <Text style={styles.name}>{card.name_tr}</Text>
            {card.reversed && <Text style={styles.reversedLabel}>{t('tarot.ters')}</Text>}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginTop: space.lg, marginHorizontal: -space.lg },
  row: { gap: space.md, paddingHorizontal: space.lg, paddingBottom: space.sm },
  fittedRow: { flexGrow: 1, justifyContent: 'center' },
  cardColumn: { flexShrink: 0 },
  position: { ...type.eyebrow, color: color.bakir, marginBottom: space.xs, textAlign: 'center' },
  frame: { overflow: 'hidden', borderRadius: radius.sm, borderWidth: 1, borderColor: color.bakirSolgun, backgroundColor: color.cezve },
  reversed: { transform: [{ rotate: '180deg' }] },
  name: { ...type.data, color: color.porselen, marginTop: space.sm, textAlign: 'center' },
  reversedLabel: { ...type.eyebrow, color: color.kiremit, textAlign: 'center', marginTop: 2 },
});
