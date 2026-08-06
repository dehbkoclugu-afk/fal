import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useDraft, type Tone } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';

/**
 * Ton seçimi.
 *
 * Bu ekran sadece kişiselleştirme değil; aynı zamanda kullanıcıya "burada söz
 * sahibiyim" hissi veriyor. Seçim backend'de prompts.system_prompt(tone=...)
 * içine gidiyor ve yorumun sesini gerçekten değiştiriyor.
 */
const TONES: { key: Tone; title: string; sample: string }[] = [
  { key: 'nazik', title: 'Nazik', sample: 'Zor bir dönemden geçiyorsun ama yalnız değilsin.' },
  { key: 'dobra', title: 'Dobra', sample: 'Bu işi sen sürüncemede bırakıyorsun, gökyüzü değil.' },
  { key: 'mistik', title: 'Mistik', sample: 'Fincanın dibinde bekleyen bir gölge var.' },
  { key: 'bilimsel', title: 'Açıklamalı', sample: 'Satürn 7. evinde: ilişkilerde sınır testi.' },
];

export default function ToneScreen() {
  const router = useRouter();
  const set = useDraft((s) => s.set);
  const [tone, setTone] = useState<Tone>('mistik');

  return (
    <Screen scroll>
      <Text style={styles.eyebrow}>Nasıl konuşayım</Text>
      <Text style={styles.q}>Hangi ses sana yakın?</Text>

      <View style={{ gap: space.md, marginTop: space.xl }}>
        {TONES.map((t) => {
          const on = tone === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setTone(t.key)}
              style={[styles.card, on && styles.cardOn]}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.cardTitle, on && { color: color.bakir }]}>{t.title}</Text>
              <Text style={styles.cardSample}>“{t.sample}”</Text>
            </Pressable>
          );
        })}
      </View>

      <Button
        label="Devam et"
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
