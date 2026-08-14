import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ArtSlot } from '@/components/ArtSlot';
import { Eyebrow } from '@/components/Eyebrow';
import type { ArtId } from '@/lib/artAssets';
import { t } from '@/lib/i18n';
import { color, radius, space, type } from '@/lib/theme';

type Props = {
  artId: ArtId;
  label: string;
  value: string;
  note: string;
  detail?: string;
  estimated?: boolean;
};

/** One leg of the onboarding's personal natal reveal. */
export function NatalRevealCard({ artId, label, value, note, detail, estimated }: Props) {
  const spoken = [label, value, detail, note, estimated ? 'tahmini' : null]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={styles.card} accessible accessibilityLabel={spoken}>
      <ArtSlot id={artId} strength="card" />
      <View style={styles.copy}>
        <View style={styles.labelLine}>
          <Eyebrow style={styles.label}>{label}</Eyebrow>
          {estimated ? <Text style={styles.estimate}>{t('ob.reveal.tahmini')}</Text> : null}
        </View>
        <Text style={styles.value}>{value}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
        <Text style={styles.note}>{note}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 138,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.cizgi,
    backgroundColor: color.cezve,
  },
  copy: { padding: space.lg, maxWidth: '72%' },
  labelLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { color: color.kul },
  estimate: {
    ...type.eyebrow,
    color: color.telve,
    backgroundColor: color.bakir,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  value: { ...type.title, color: color.porselen, marginTop: space.xs },
  detail: { ...type.dataStrong, color: color.bakir, marginTop: 2 },
  note: { ...type.body, color: color.kul, marginTop: space.sm },
});
