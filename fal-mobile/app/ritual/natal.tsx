/**
 * Doğum haritası ritüeli — odak seçimi.
 *
 * Doğum haritası ürünün "hesaplanmış" tarafı. Kullanıcı yorum satın almadan
 * kendi gezegen, ev ve açı çemberini görür; odak seçimi bu gerçek haritanın
 * altında kalır. Konu görselleri seçimin anlamını destekler, haritanın yerine
 * geçmez.
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
import { t } from '@/lib/i18n';
import { NatalChartWheel } from '@/components/NatalChartWheel';
import { RitualVisual } from '@/components/RitualVisual';
import { ArtSlot } from '@/components/ArtSlot';
import type { ArtId } from '@/lib/artAssets';

// `key` sunucuya `focus` olarak gidiyor ve orada Literal ile doğrulanıyor:
// SABİT kalmak zorunda. Çeviri çıkarımı bunları da t() ile sarmıştı;
// Türkçe katalog değerleri anahtarlarla aynı olduğu için hata görünmüyordu,
// ikinci dilde her doğum haritası isteği 422 dönecekti.
const ODAKLAR = [
  { key: 'genel', title: 'natal.butunHarita', note: 'natal.butunHaritaNot', artId: 'general' },
  { key: 'ask', title: 'natal.ask', note: 'natal.askNot', artId: 'love' },
  { key: 'para', title: 'natal.para', note: 'natal.paraNot', artId: 'money' },
  { key: 'kariyer', title: 'natal.kariyer', note: 'natal.kariyerNot', artId: 'career' },
  { key: 'kendim', title: 'natal.kendim', note: 'natal.kendimNot', artId: 'self' },
] as const;

export default function Natal() {
  const router = useRouter();
  const [odak, setOdak] = useState<string>('genel');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });
  const { data: chartData } = useQuery({
    queryKey: ['natal-chart'],
    queryFn: api.natalChart,
    enabled: !!me?.has_birth_data,
    retry: 1,
  });
  const fiyat = me?.prices?.natal ?? 5;
  const abone = !!me?.entitlement;
  const yetersiz = !abone && (me?.coins ?? 0) < fiyat;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await api.natal(odak);
      router.replace(`/reading/${r.reading_id}?kind=natal`);
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

      {chartData?.chart ? (
        <NatalChartWheel chart={chartData.chart} compact />
      ) : (
        <View style={styles.preview}><RitualVisual kind="natal" size={220} /></View>
      )}

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
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`${t(o.title)}, ${t(o.note)}`}
                style={({ pressed }) => [styles.row, on && styles.rowOn, pressed && styles.rowPressed]}
              >
                <ArtSlot id={o.artId as ArtId} strength="soft" selected={on} />
                <View style={styles.rowText}>
                  <Eyebrow style={[styles.rowEyebrow, on && styles.rowEyebrowOn]}>
                    {on ? t('natal.secili') : t('natal.odak')}
                  </Eyebrow>
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
      <View style={styles.purchaseContext} accessibilityLiveRegion="polite">
        <Eyebrow style={styles.purchaseLabel}>{t('natal.ucretBaslik')}</Eyebrow>
        <Text style={styles.purchaseValue}>
          {abone
            ? t('natal.aboneligeDahil')
            : t('natal.bakiyeVeUcret', { bakiye: me?.coins ?? 0, ucret: fiyat })}
        </Text>
        {!abone ? <Text style={styles.purchaseNote}>{t('natal.tekSeferNot')}</Text> : null}
      </View>
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
  list: { marginTop: space.xl, gap: space.sm },
  row: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 116,
    paddingVertical: space.lg,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.cizgi,
    backgroundColor: color.cezve,
  },
  rowOn: { borderColor: color.bakir },
  rowPressed: { opacity: 0.88 },
  rowText: { flex: 1, maxWidth: '72%' },
  preview: { alignItems: 'center', marginTop: space.lg },
  rowEyebrow: { color: color.kulKoyu, marginBottom: space.xs },
  rowEyebrowOn: { color: color.bakir },
  rowTitle: { ...type.bodyStrong, color: color.kul, fontSize: 17 },
  rowNote: { ...type.data, color: color.kul, fontSize: 11, marginTop: 4 },
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
  purchaseContext: {
    borderTopWidth: 1,
    borderTopColor: color.cizgi,
    paddingTop: space.lg,
    marginBottom: space.md,
  },
  purchaseLabel: { color: color.kulKoyu },
  purchaseValue: { ...type.dataStrong, color: color.porselen, marginTop: space.xs },
  purchaseNote: { ...type.body, color: color.kul, fontSize: 12, marginTop: space.xs },
});
