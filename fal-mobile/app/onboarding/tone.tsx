import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useDraft, type Tone } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { ArtSlot } from '@/components/ArtSlot';
import { artForKey } from '@/lib/artAssets';
import { t } from '@/lib/i18n';

/**
 * Ton seçimi.
 *
 * Bu ekran sadece kişiselleştirme değil; aynı zamanda kullanıcıya "burada söz
 * sahibiyim" hissi veriyor. Seçim backend'de prompts.system_prompt(tone=...)
 * içine gidiyor ve yorumun sesini gerçekten değiştiriyor.
 */
// Örnek cümleler de çeviri gerektiriyor: her tonun NASIL konuştuğunu
// gösteriyorlar ve bu dile göre değişir.
const TONES = [
  { key: 'nazik' as Tone, title: 'ton.nazik' as const, sample: 'ton.nazikOrnek' as const },
  { key: 'dobra' as Tone, title: 'ton.dobra' as const, sample: 'ton.dobraOrnek' as const },
  { key: 'mistik' as Tone, title: 'ton.mistik' as const, sample: 'ton.mistikOrnek' as const },
  { key: 'bilimsel' as Tone, title: 'ton.bilimsel' as const, sample: 'ton.bilimselOrnek' as const },
];

export default function ToneScreen() {
  const router = useRouter();
  const set = useDraft((s) => s.set);
  const [tone, setTone] = useState<Tone>('mistik');

  return (
    <Screen scroll>
      <Eyebrow style={styles.eyebrow}>{t('ob.ton.eyebrow')}</Eyebrow>
      <Text style={styles.q}>{t('ob.ton.soru')}</Text>

      <View style={{ gap: space.md, marginTop: space.xl }}>
        {/* Map değişkenini `t` diye adlandırmak i18n `t()`'sini gölgeliyor ve
            ekranda çeviri yerine anahtarın kendisi çıkıyor — `secenek` kalsın. */}
        {TONES.map((secenek) => {
          const on = tone === secenek.key;
          return (
            <Pressable
              key={secenek.key}
              onPress={() => setTone(secenek.key)}
              style={[styles.card, on && styles.cardOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <ArtSlot id={artForKey(secenek.key, 'topic')} strength="strong" />
              <Text style={[styles.cardTitle, on && { color: color.bakir }]}>
                {t(secenek.title)}
              </Text>
              <Text style={styles.cardSample}>“{t(secenek.sample)}”</Text>
            </Pressable>
          );
        })}
      </View>

      <Button
        label={t('ortak.devam')}
        style={{ marginTop: space.xl }}
        onPress={() => {
          set({ tone });
          router.push('/onboarding/notifications');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul, marginTop: space.xl },
  q: { ...type.title, color: color.porselen, marginTop: space.sm },
  card: {
    position: 'relative',
    overflow: 'hidden',
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.cizgi,
    backgroundColor: color.cezve,
  },
  cardOn: { borderColor: color.bakir, backgroundColor: color.cezveUst },
  cardTitle: { ...type.eyebrow, color: color.kul },
  cardSample: { ...type.oracle, color: color.porselen, marginTop: space.sm },
});
