import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useDraft } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { t } from '@/lib/i18n';

const STATUSES = [t('ob.tani.iliskiYok'), t('ob.tani.iliskiVar'), t('ob.tani.evli'), t('ob.tani.karisik')];
const FOCUS = [t('konu.ask'), t('konu.para'), 'kariyer', t('konu.aile'), t('konu.kendim')];

export default function AboutYou() {
  const router = useRouter();
  const set = useDraft((s) => s.set);
  const [status, setStatus] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  return (
    <Screen scroll>
      <Eyebrow style={styles.eyebrow}>{t('ob.tani.eyebrow')}</Eyebrow>
      <Text style={styles.q}>{t('ob.tani.soru')}</Text>

      <Eyebrow style={styles.label}>{t('ob.tani.iliskiDurumu')}</Eyebrow>
      <View style={styles.chips}>
        {STATUSES.map((s) => (
          <Chip key={s} label={s} on={status === s} onPress={() => setStatus(s)} />
        ))}
      </View>

      <Eyebrow style={styles.label}>{t('ob.tani.merak')}</Eyebrow>
      <View style={styles.chips}>
        {FOCUS.map((f) => (
          <Chip key={f} label={f} on={focus === f} onPress={() => setFocus(f)} />
        ))}
      </View>

      <Button
        label={t('ortak.devam')}
        disabled={!status || !focus}
        style={{ marginTop: space.xxl }}
        onPress={() => {
          set({ relationshipStatus: status!, focusTopic: focus! });
          router.push('/onboarding/tone');
        }}
      />
    </Screen>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button">
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul, marginTop: space.xl },
  q: { ...type.title, color: color.porselen, marginTop: space.sm },
  label: { ...type.eyebrow, color: color.kulKoyu, marginTop: space.xl, marginBottom: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.cizgi,
  },
  chipOn: { backgroundColor: color.cezveUst, borderColor: color.bakir },
  chipText: { ...type.body, color: color.kul },
  chipTextOn: { color: color.porselen },
});
