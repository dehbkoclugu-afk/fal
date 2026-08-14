/**
 * reveal — onboarding'in en kritik ekranı.
 *
 * Buradaki tek iş: kullanıcı hiçbir şey ödemeden, hiçbir şey beklemeden
 * KENDİSİ hakkında doğru bir şey görsün. Yükselen burcunu ilk kez öğrenen
 * kullanıcı akışa bağlanır; bu ekran olmadan 7. adımda bırakma oranı iki katına
 * çıkıyor.
 *
 * Sıralama kasıtlı: harita önce hesaplanır (backend ephemeris), sonra üç değer
 * tek tek açılır. Aynı anda göstermek "hazır şablon" hissi verir; sırayla
 * açılması "az önce hesaplandı" hissi verir.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TelveRing } from '@/components/TelveRing';
import { api, ApiError, type NatalChart, type Teaser } from '@/lib/api';
import { useDraft } from '@/lib/store';
import { color, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { t } from '@/lib/i18n';
import { NatalChartWheel } from '@/components/NatalChartWheel';
import { RitualVisual } from '@/components/RitualVisual';
import { NatalRevealCard } from '@/components/NatalRevealCard';

export default function Reveal() {
  const router = useRouter();
  const draft = useDraft((s) => s.draft);
  const [teaser, setTeaser] = useState<Teaser | null>(null);
  const [chart, setChart] = useState<NatalChart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0.15);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    let alive = true;
    // Hesap hızlı biter; halkayı yine de doldur — bekleme ritüelinin ilk provası
    const tick = setInterval(() => setProgress((p) => Math.min(0.9, p + 0.12)), 220);

    api
      .saveProfile({
        first_name: draft.firstName,
        birth_date: draft.birthDate,
        birth_time: draft.timeKnown ? draft.birthTime : null,
        time_known: draft.timeKnown,
        place_name: draft.placeName,
        lat: draft.lat,
        lon: draft.lon,
        tz_name: draft.tzName ?? 'Europe/Istanbul',
        tone: draft.tone,
      })
      .then((r) => {
        if (!alive) return;
        setProgress(1);
        setTeaser(r.teaser);
        setChart(r.chart);
      })
      .catch((e: ApiError) => alive && setError(e.message))
      .finally(() => clearInterval(tick));

    return () => {
      alive = false;
      clearInterval(tick);
    };
  }, []);

  const rows = teaser
    ? [
        {
          key: 'ascendant', artId: 'natal-wheel' as const, label: t('ob.reveal.yukselen'),
          value: teaser.yukselen, note: t('ob.reveal.yukselenNot'),
          detail: chart ? `${chart.ascendant.toFixed(1)}°` : undefined,
          estimated: !draft.timeKnown,
        },
        {
          key: 'sun', artId: 'natal-planets' as const, label: t('ob.reveal.gunes'),
          value: teaser.gunes, note: t('ob.reveal.gunesNot'),
          detail: chart?.bodies.sun ? `${chart.bodies.sun.degree_in_sign.toFixed(1)}°` : undefined,
        },
        {
          key: 'moon', artId: 'natal-aspects' as const, label: t('ob.reveal.ay'),
          value: teaser.ay, note: t('ob.reveal.ayNot'),
          detail: chart?.bodies.moon ? `${chart.bodies.moon.degree_in_sign.toFixed(1)}°` : undefined,
        },
      ]
    : [];

  const reveal = (delay = 0) => reducedMotion
    ? undefined
    : FadeInDown.delay(delay).duration(520);

  return (
    <Screen scroll>
      {!chart ? (
        <View style={styles.ringWrap}>
          <TelveRing size={220} value={progress} mode="ritual" breathing={!teaser} />
          <View style={styles.chartPreview}><RitualVisual kind="natal" size={170} /></View>
          <View style={styles.ringCenter} pointerEvents="none">
            <Text style={styles.calc}>{t('ob.reveal.hesaplaniyor')}</Text>
          </View>
        </View>
      ) : (
        <Animated.View entering={reveal()}>
          <NatalChartWheel chart={chart} compact />
          <View style={styles.phaseLine}>
            <Eyebrow style={styles.phase}>{teaser?.ay_fazi}</Eyebrow>
            <Text style={styles.personal}>{t('ob.reveal.kisisel')}</Text>
          </View>
        </Animated.View>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button label={t('ortak.tekrarDeneButon')} variant="ghost" onPress={() => router.replace('/onboarding/reveal')} />
        </View>
      ) : (
        <>
          <View style={styles.list}>
            {rows.map((r, i) => (
              <Animated.View key={r.key} entering={reveal(i * 240)}>
                <NatalRevealCard {...r} />
              </Animated.View>
            ))}
          </View>

          {teaser && (
            <Animated.View entering={reveal(820)}>
              {!draft.timeKnown && (
                <Text style={styles.warn}>{t('ob.reveal.saatYokUyari')}</Text>
              )}
              <Button
                label={t('ortak.devam')}
                onPress={() => router.push('/onboarding/about-you')}
                style={{ marginTop: space.lg }}
              />
            </Animated.View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  ringWrap: { alignItems: 'center', justifyContent: 'center', marginTop: space.xl },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  chartPreview: { position: 'absolute', opacity: 0.68 },
  calc: { ...type.data, color: color.kul, textAlign: 'center', fontSize: 11 },
  phaseLine: { alignItems: 'center', gap: space.xs, marginTop: space.sm },
  phase: { ...type.eyebrow, color: color.bakir, textAlign: 'center' },
  personal: { ...type.data, color: color.kulKoyu, fontSize: 11 },

  list: { marginTop: space.xl, gap: space.md },

  warn: { ...type.body, color: color.kul, marginTop: space.lg, fontSize: 13 },
  errorBox: { marginTop: space.xxl, gap: space.lg },
  errorText: { ...type.body, color: color.kiremit },
});
