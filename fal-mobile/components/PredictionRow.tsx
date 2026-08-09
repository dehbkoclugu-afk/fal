/**
 * PredictionRow — Kader Günlüğü'nün satırı.
 *
 * Defter kaydı: monospace, hairline ayırıcı, sıfır süs. Ritüel ekranlarının
 * sıcaklığının tam tersi, kasıtlı olarak. Bir tahminin hesabını görmek
 * mistik bir an değil, muhasebe anı.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { color, hitStyle, space, type, type Verdict } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { ArtSlot } from '@/components/ArtSlot';
import { artForKey } from '@/lib/artAssets';
import { t } from '@/lib/i18n';

type Props = {
  claim: string;
  topic: string;
  dueAt: string;
  verdict: Verdict;
  /** Bildirimle gelinen satır — kullanıcı hangisi için çağrıldığını görsün. */
  vurgulu?: boolean;
  onVerdict?: (v: 'hit' | 'partial' | 'miss') => void;
};

// Anahtar tutuluyor, metin render anında üretiliyor: modül gövdesindeki
// t() dili içe aktarma anında dondurur. ('kariyer' burada ayrıca ham dize
// olarak kalmıştı, yani hiç çevrilmiyordu.)
const KONU_ANAHTAR = {
  ask: 'konu.ask',
  para: 'konu.para',
  kariyer: 'konu.kariyer',
  aile: 'konu.aile',
  saglik: 'konu.saglik',
  kendim: 'konu.kendim',
  genel: 'konu.genel',
} as const;

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function PredictionRow({ claim, topic, dueAt, verdict, vurgulu, onVerdict }: Props) {
  const s = hitStyle[verdict];
  const answerable = verdict === 'pending' && !!onVerdict;

  const answer = (v: 'hit' | 'partial' | 'miss') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVerdict?.(v);
  };

  return (
    <View style={[styles.row, vurgulu && styles.rowVurgulu]}>
      <ArtSlot id={artForKey(`${topic}:${claim}:${dueAt}`, 'topic')} strength="strong" />
      <View style={styles.meta}>
        <Text style={styles.date}>{shortDate(dueAt)}</Text>
        <Eyebrow style={styles.topic}>
          {topic in KONU_ANAHTAR ? t(KONU_ANAHTAR[topic as keyof typeof KONU_ANAHTAR]) : topic}
        </Eyebrow>
        <View style={styles.spacer} />
        <Text style={[styles.state, { color: s.color }]}>{s.label}</Text>
      </View>

      <Text style={styles.claim}>{claim}</Text>

      {answerable && (
        <View style={styles.actions}>
          {(['hit', 'partial', 'miss'] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => answer(v)}
              style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
              accessibilityRole="button"
            >
              <Text style={[styles.btnText, { color: hitStyle[v].color }]}>
                {hitStyle[v].label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: 6,
    marginBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: color.cizgi,
  },
  // Defter kaydının klinik dilinden çıkmadan işaretlemek: sol kenarda ince
  // bir bakır çizgi. Dolgu veya renk, satırı "sonuç" gibi gösterirdi.
  rowVurgulu: {
    borderLeftWidth: 2,
    borderLeftColor: color.bakir,
    paddingLeft: space.md,
    marginLeft: -space.md,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  date: { ...type.data, color: color.kulKoyu },
  topic: { ...type.eyebrow, color: color.kul, fontSize: 10 },
  spacer: { flex: 1 },
  state: { ...type.dataStrong, fontSize: 11 },
  claim: { ...type.body, color: color.porselen, marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  btn: {
    flex: 1,
    paddingVertical: space.sm,
    borderWidth: 1,
    borderColor: color.cizgi,
    alignItems: 'center',
  },
  btnPressed: { backgroundColor: color.cezveUst },
  btnText: { ...type.dataStrong, fontSize: 12 },
});
