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

type Props = {
  claim: string;
  topic: string;
  dueAt: string;
  verdict: Verdict;
  onVerdict?: (v: 'hit' | 'partial' | 'miss') => void;
};

const TOPIC_TR: Record<string, string> = {
  ask: 'aşk', para: 'para', kariyer: 'kariyer', aile: 'aile',
  kendim: 'kendim', genel: 'genel',
};

function shortDate(iso: string) {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function PredictionRow({ claim, topic, dueAt, verdict, onVerdict }: Props) {
  const s = hitStyle[verdict];
  const answerable = verdict === 'pending' && !!onVerdict;

  const answer = (v: 'hit' | 'partial' | 'miss') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onVerdict?.(v);
  };

  return (
    <View style={styles.row}>
      <View style={styles.meta}>
        <Text style={styles.date}>{shortDate(dueAt)}</Text>
        <Text style={styles.topic}>{TOPIC_TR[topic] ?? topic}</Text>
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
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.cizgi,
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
