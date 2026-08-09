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
import { CoinGate } from '@/components/CoinGate';
import { Screen } from '@/components/Screen';
import { api, ApiError } from '@/lib/api';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { ArtSlot } from '@/components/ArtSlot';
import { artForKey } from '@/lib/artAssets';
import { t } from '@/lib/i18n';

// `key` API'ye gidiyor ve SABİT kalmak zorunda; `title` ekranda görünüyor
// ve dile göre değişiyor. İkisini aynı yerde t() ile üretmek, çeviri
// çıkarımı sırasında API anahtarlarının da çevrilmesine yol açtı.
const SPREADS = [
  { key: 'single', title: 'tarot.gununKarti', count: 1, coins: 1 },
  { key: 'three_card', title: 'tarot.ucKart', count: 3, coins: 1 },
  { key: 'love_five', title: 'tarot.askAcilimi', count: 5, coins: 2 },
] as const;

const DECK_SIZE = 12; // görsel deste; gerçek çekim sunucuda 78 karttan yapılır

export default function Tarot() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [spread, setSpread] = useState<(typeof SPREADS)[number]>(SPREADS[1]);
  const [picked, setPicked] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jetonYok, setJetonYok] = useState(false);

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
      const err = e as ApiError;
      if (err.code === 'insufficient_coins') {
        setJetonYok(true);
        setError(null);
      } else {
        setError(err.message);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Eyebrow style={styles.eyebrow}>{t('tarot.eyebrow')}</Eyebrow>

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
              <Text style={[styles.spreadText, on && { color: color.porselen }]}>{t(s.title)}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.instruction}>
        {done
          ? t('tarot.kartlarSecildi')
          : t('tarot.kartSec', { n: spread.count - picked.length })}
      </Text>

      <View style={styles.deck}>
        {Array.from({ length: DECK_SIZE }).map((_, i) => (
          <TarotCard key={i} width={cardW} index={i} picked={picked.includes(i)} onPress={() => pick(i)} />
        ))}
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {jetonYok && <CoinGate kind="tarot" />}

      <Button
        label={t('tarot.acilimiOku', { n: spread.coins })}
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
        accessibilityLabel={t('tarot.kartNo', { n: index + 1 })}
        style={[
          styles.card,
          { width, height: width * 1.6 },
          picked && styles.cardPicked,
        ]}
      >
        <ArtSlot id={artForKey(`tarot-card-${index}`)} strength={picked ? 'soft' : 'card'} />
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
    position: 'relative',
    overflow: 'hidden',
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
