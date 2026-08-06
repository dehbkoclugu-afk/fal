/**
 * Tarot açılımı — deste seçimi.
 *
 * Ritüel tasarımı: kullanıcı kartı KENDİSİ seçiyor. Sunucu zaten deterministik
 * çekim yapıyor (tarot.py, seed saklı), ama kullanıcının desteden dokunarak
 * seçmesi sahiplik hissi üretiyor. Bu his ödeme isteğine doğrudan etki ediyor.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { api, ApiError } from '@/lib/api';
import { color, radius, space, type } from '@/lib/theme';

const SPREADS = [
  { key: 'single', title: 'Günün kartı', count: 1, coins: 1 },
  { key: 'three_card', title: 'Geçmiş · Şimdi · Gelecek', count: 3, coins: 1 },
  { key: 'love_five', title: 'Aşk açılımı', count: 5, coins: 2 },
] as const;

const DECK_SIZE = 12; // görsel deste; gerçek çekim sunucuda 78 karttan yapılır

export default function Tarot() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [spread, setSpread] = useState<(typeof SPREADS)[number]>(SPREADS[1]);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cardW = (width - space.lg * 2 - space.sm * 3) / 4;
  const done = picked.length === spread.count;

  const pick = (i: number) => {
    if (picked.includes(i) || done) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPicked((p) => [...p, i]);
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.tarot(spread.key, '');
      router.replace(`/reading/${r.reading_id}`);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Text style={styles.eyebrow}>tarot</Text>

      <View style={styles.spreads}>
        {SPREADS.map((s) => {
          const on = spread.key === s.key;
          return (
            <Pressable
              key={s.key}
              onPress={() => {
                setSpread(s);
                setPicked([]);
              }}
              style={[styles.spreadChip, on && styles.spreadChipOn]}
            >
              <Text style={[styles.spreadText, on && { color: color.porselen }]}>{s.title}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.instruction}>
        {done
          ? 'Kartlar seçildi.'
          : `Desteden ${spread.count - picked.length} kart seç. Aklındaki soruyu düşün.`}
      </Text>

      <View style={styles.deck}>
        {Array.from({ length: DECK_SIZE }).map((_, i) => (
          <TarotCard key={i} width={cardW} index={i} picked={picked.includes(i)} onPress={() => pick(i)} />
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}

      <Button
        label={`Açılımı oku · ${spread.coins} jeton`}
        disabled={!done}
        loading={busy}
        onPress={submit}
        style={{ marginTop: space.xl }}
      />
    </Screen>
  );
}

function TarotCard({
  width,
  index,
  picked,
  onPress,
}: {
  width: number;
  index: number;
  picked: boolean;
  onPress: () => void;
}) {
  const lift = useSharedValue(0);
  React.useEffect(() => {
    lift.value = withSpring(picked ? -10 : 0, { damping: 14 });
  }, [picked]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));

  return (
    <Animated.View entering={FadeIn.delay(index * 40)} style={style}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${index + 1}. kart`}
        style={[
          styles.card,
          { width, height: width * 1.6 },
          picked && styles.cardPicked,
        ]}
      >
        {/* Kart arkası deseni: fincan kenarındaki çini motifinin sadeleşmiş hâli */}
        <View style={styles.cardMotif} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul },
  spreads: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  spreadChip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.cizgi,
  },
  spreadChipOn: { borderColor: color.bakir, backgroundColor: color.cezveUst },
  spreadText: { ...type.data, color: color.kul, fontSize: 12 },
  instruction: { ...type.oracle, color: color.porselen, marginTop: space.xl },
  deck: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.lg },
  card: {
    borderRadius: radius.sm,
    backgroundColor: color.cezve,
    borderWidth: 1,
    borderColor: color.cizgi,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPicked: { borderColor: color.bakir, backgroundColor: color.cezveUst },
  cardMotif: {
    width: '46%',
    aspectRatio: 1,
    borderWidth: 1,
    borderColor: color.bakirSolgun,
    transform: [{ rotate: '45deg' }],
  },
  error: { ...type.body, color: color.kiremit, marginTop: space.md },
});
