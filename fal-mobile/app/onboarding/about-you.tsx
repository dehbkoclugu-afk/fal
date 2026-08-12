import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useDraft } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { t } from '@/lib/i18n';

// Saklanan değer SABİT, gösterilen etiket dile göre. Kullanıcı dilini
// sonradan değiştirdiğinde profilindeki seçim bozulmasın diye: etiketi
// saklamak, eski dildeki kelimeyi kalıcı hâle getiriyordu.
const DURUMLAR = [
  { key: 'yalniz', label: 'ob.tani.iliskiYok' },
  { key: 'iliskide', label: 'ob.tani.iliskiVar' },
  { key: 'evli', label: 'ob.tani.evli' },
  { key: 'karisik', label: 'ob.tani.karisik' },
  { key: 'belirtmek_istemiyor', label: 'ob.tani.belirtmekIstemiyorum' },
] as const;
const ODAKLAR = [
  { key: 'ask', label: 'konu.ask' },
  { key: 'para', label: 'konu.para' },
  { key: 'kariyer', label: 'konu.kariyer' },
  { key: 'aile', label: 'konu.aile' },
  { key: 'kendim', label: 'konu.kendim' },
] as const;

export default function AboutYou() {
  const router = useRouter();
  const set = useDraft((s) => s.set);
  const [status, setStatus] = useState<string | null>(null);
  const [focus, setFocus] = useState<string | null>(null);

  return (
    <Screen scroll>
      <Eyebrow style={styles.eyebrow}>{t('ob.tani.eyebrow')}</Eyebrow>
      <Text style={styles.q}>{t('ob.tani.soru')}</Text>
      <Text style={styles.why}>{t('ob.tani.neden')}</Text>

      <Eyebrow style={styles.label}>{t('ob.tani.iliskiDurumu')}</Eyebrow>
      <View style={styles.chips}>
        {DURUMLAR.map((d) => (
          <Chip key={d.key} label={t(d.label)} on={status === d.key}
                onPress={() => setStatus(d.key)} />
        ))}
      </View>

      <Eyebrow style={styles.label}>{t('ob.tani.merak')}</Eyebrow>
      <Text style={styles.choiceHint}>{t('ob.tani.tekSecim')}</Text>
      <View style={styles.chips}>
        {ODAKLAR.map((o) => (
          <Chip key={o.key} label={t(o.label)} on={focus === o.key}
                onPress={() => setFocus(o.key)} />
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
    <Pressable
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
      accessibilityRole="radio"
      accessibilityState={{ selected: on }}
    >
      {on && <Text style={styles.check}>✓</Text>}
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul, marginTop: space.xl },
  q: { ...type.title, color: color.porselen, marginTop: space.sm },
  why: { ...type.body, color: color.kul, marginTop: space.md },
  label: { ...type.eyebrow, color: color.kulKoyu, marginTop: space.xl, marginBottom: space.md },
  choiceHint: { ...type.data, color: color.kul, fontSize: 11, marginBottom: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.cizgi,
  },
  chipOn: { backgroundColor: color.cezveUst, borderColor: color.bakir },
  chipText: { ...type.body, color: color.kul },
  chipTextOn: { color: color.porselen },
  check: { ...type.bodyStrong, color: color.bakir },
});
