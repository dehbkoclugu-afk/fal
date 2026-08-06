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
        { key: 'Yükselen', value: teaser.yukselen, note: 'dışa dönük yüzün' },
        { key: 'Güneş', value: teaser.gunes, note: 'özün' },
        { key: 'Ay', value: teaser.ay, note: 'duygun' },
      ]
    : [];

  return (
    <Screen>
      <View style={styles.ringWrap}>
        <TelveRing size={220} value={progress} mode="ritual" breathing={!teaser} />
        <View style={styles.ringCenter} pointerEvents="none">
          {teaser ? (
            <Text style={styles.phase}>{teaser.ay_fazi}</Text>
          ) : (
            <Text style={styles.calc}>haritan{'\n'}çiziliyor</Text>
          )}
        </View>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <Button label="Tekrar dene" variant="ghost" onPress={() => router.replace('/onboarding/reveal')} />
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
                <Text style={styles.rowKey}>{r.key}</Text>
                <Text style={styles.rowValue}>{r.value}</Text>
                <Text style={styles.rowNote}>{r.note}</Text>
              </Animated.View>
            ))}
          </View>

          {teaser && (
            <Animated.View entering={FadeInDown.delay(1100).duration(520)}>
              {!draft.timeKnown && (
                <Text style={styles.warn}>
                  Doğum saatini bilmediğin için yükselen tahmini. Sonradan profilinden
                  ekleyebilirsin.
                </Text>
              )}
              <Button
                label="Devam et"
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
  row: { borderTopWidth: 1, borderTopColor: color.cizgi, paddingTop: space.md },
  rowKey: { ...type.eyebrow, color: color.kul },
  rowValue: { ...type.title, color: color.porselen, marginTop: 2 },
  rowNote: { ...type.data, color: color.kulKoyu, fontSize: 11 },

  warn: { ...type.body, color: color.kul, marginTop: space.lg, fontSize: 13 },
  errorBox: { marginTop: space.xxl, gap: space.lg },
  errorText: { ...type.body, color: color.kiremit },
});
