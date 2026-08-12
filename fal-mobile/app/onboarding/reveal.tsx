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
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { TelveRing } from '@/components/TelveRing';
import { api, ApiError, type Teaser } from '@/lib/api';
import { useDraft } from '@/lib/store';
import { color, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { ArtSlot } from '@/components/ArtSlot';
import { artForKey } from '@/lib/artAssets';
import { t } from '@/lib/i18n';

export default function Reveal() {
  const router = useRouter();
  const draft = useDraft((s) => s.draft);
  const [teaser, setTeaser] = useState<Teaser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0.15);

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
        { key: t('ob.reveal.yukselen'), value: teaser.yukselen, note: t('ob.reveal.yukselenNot') },
        { key: t('ob.reveal.gunes'), value: teaser.gunes, note: t('ob.reveal.gunesNot') },
        { key: t('ob.reveal.ay'), value: teaser.ay, note: t('ob.reveal.ayNot') },
      ]
    : [];

  return (
    <Screen scroll>
      <View style={styles.ringWrap}>
        <TelveRing size={200} value={progress} mode="ritual" breathing={!teaser} />
        <View style={styles.ringCenter} pointerEvents="none">
          {teaser ? (
            <Eyebrow style={styles.phase}>{teaser.ay_fazi}</Eyebrow>
          ) : (
            <Text style={styles.calc}>{t('ob.reveal.hesaplaniyor')}</Text>
          )}
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button label={t('ortak.tekrarDeneButon')} variant="ghost" onPress={() => router.replace('/onboarding/reveal')} />
        </View>
      ) : (
        <>
          <View style={styles.list}>
            {rows.map((r, i) => (
              <Animated.View
                key={r.key}
                entering={FadeInDown.delay(i * 320).duration(520)}
                style={styles.row}
              >
                <ArtSlot id={artForKey(r.key, 'topic')} strength="strong" />
                <Eyebrow style={styles.rowKey}>{r.key}</Eyebrow>
                <Text style={styles.rowValue}>{r.value}</Text>
                <Text style={styles.rowNote}>{r.note}</Text>
              </Animated.View>
            ))}
          </View>

          {teaser && (
            <Animated.View entering={FadeInDown.delay(1100).duration(520)}>
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
  calc: { ...type.data, color: color.kul, textAlign: 'center', fontSize: 11 },
  phase: { ...type.eyebrow, color: color.bakir, textAlign: 'center' },

  list: { marginTop: space.xxl, gap: space.lg },
  row: {
    position: 'relative', overflow: 'hidden', borderTopWidth: 1,
    borderTopColor: color.cizgi, padding: space.md, borderRadius: 6,
  },
  rowKey: { ...type.eyebrow, color: color.kul },
  rowValue: { ...type.title, color: color.porselen, marginTop: 2 },
  rowNote: { ...type.data, color: color.kulKoyu, fontSize: 11 },

  warn: { ...type.body, color: color.kul, marginTop: space.lg, fontSize: 13 },
  errorBox: { marginTop: space.xxl, gap: space.lg },
  errorText: { ...type.body, color: color.kiremit },
});
