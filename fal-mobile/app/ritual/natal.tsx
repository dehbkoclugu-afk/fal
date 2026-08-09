/**
 * Doğum haritası ritüeli — odak seçimi.
 *
 * Tasarım kararı: bu ekran kart/animasyon göstermiyor. Doğum haritası ürünün
 * "hesaplanmış" tarafı; ritüel süsü eklemek onu tarotla aynı kovaya koyar ve
 * asıl farkı (gerçek ephemeris) gizler. Bu yüzden ekran defter kaydında:
 * mono etiketler, ince cetvel çizgileri, süssüz.
 *
 * Kullanıcının haritası zaten onboarding'de hesaplandı; burada seçilen tek şey
 * yorumun hangi eksene ağırlık vereceği.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { CoinGate } from '@/components/CoinGate';
import { Screen } from '@/components/Screen';
import { api, ApiError } from '@/lib/api';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { ArtSlot } from '@/components/ArtSlot';
import { artForKey } from '@/lib/artAssets';
import { t } from '@/lib/i18n';

// `key` sunucuya `focus` olarak gidiyor ve orada Literal ile doğrulanıyor:
// SABİT kalmak zorunda. Çeviri çıkarımı bunları da t() ile sarmıştı;
// Türkçe katalog değerleri anahtarlarla aynı olduğu için hata görünmüyordu,
// ikinci dilde her doğum haritası isteği 422 dönecekti.
const ODAKLAR = [
  { key: 'genel', title: 'natal.butunHarita', note: 'natal.butunHaritaNot' },
  { key: 'ask', title: 'natal.ask', note: 'natal.askNot' },
  { key: 'para', title: 'natal.para', note: 'natal.paraNot' },
  { key: 'kariyer', title: 'natal.kariyer', note: 'natal.kariyerNot' },
  { key: 'kendim', title: 'natal.kendim', note: 'natal.kendimNot' },
] as const;

export default function Natal() {
  const router = useRouter();
  const [odak, setOdak] = useState<string>('genel');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });
  const fiyat = me?.prices?.natal ?? 5;
  const abone = !!me?.entitlement;
  const yetersiz = !abone && (me?.coins ?? 0) < fiyat;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.natal(odak);
      router.replace(`/reading/${r.reading_id}`);
    } catch (e) {
      setError((e as ApiError).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Eyebrow style={styles.eyebrow}>{t('natal.eyebrow')}</Eyebrow>
      <Text style={styles.title}>{t('natal.baslik')}</Text>
      <Text style={styles.lead}>{t('natal.aciklama')}</Text>

      <View style={styles.list}>
        {ODAKLAR.map((o, i) => {
          const on = odak === o.key;
          return (
            <Animated.View key={o.key} entering={FadeIn.delay(i * 45)}>
              <Pressable
                onPress={() => {
                  Haptics.selectionAsync();
                  setOdak(o.key);
                }}
                style={[styles.row, on && styles.rowOn]}
              >
                <ArtSlot id={artForKey(o.key, 'topic')} strength="strong" />
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, on && { color: color.porselen }]}>
                    {t(o.title)}
                  </Text>
                  <Text style={styles.rowNote}>{t(o.note)}</Text>
                </View>
                <View style={[styles.dot, on && styles.dotOn]} />
              </Pressable>
            </Animated.View>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.spacer} />
      <Button
        label={abone ? t('natal.yorumla') : t('natal.yorumlaJeton', { n: fiyat })}
        loading={busy}
        disabled={yetersiz}
        onPress={submit}
      />
      {yetersiz ? <CoinGate kind="natal" /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul, marginTop: space.lg },
  title: { ...type.title, color: color.porselen, marginTop: space.sm },
  lead: { ...type.body, color: color.kul, marginTop: space.md },
  list: { marginTop: space.xl },
  row: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    marginBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: color.cizgi,
  },
  rowOn: { borderBottomColor: color.bakir },
  rowText: { flex: 1 },
  rowTitle: { ...type.data, color: color.kul, fontSize: 14 },
  rowNote: { ...type.data, color: color.kulKoyu, fontSize: 11, marginTop: 4 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: color.cizgi,
  },
  dotOn: { backgroundColor: color.bakir, borderColor: color.bakir },
  error: { ...type.data, color: color.kiremit, marginTop: space.lg, fontSize: 12 },
  hint: {
    ...type.data,
    color: color.kulKoyu,
    fontSize: 11,
    marginTop: space.md,
    textAlign: 'center',
  },
  spacer: { height: space.xl },
});
