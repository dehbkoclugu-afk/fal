import React, { useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Haptics from 'expo-haptics';

import { ArtSlot } from '@/components/ArtSlot';
import { Eyebrow } from '@/components/Eyebrow';
import { NatalChartWheel } from '@/components/NatalChartWheel';
import type { NatalChart } from '@/lib/api';
import { t } from '@/lib/i18n';
import { color, radius, space, type } from '@/lib/theme';

type Props = {
  chart: NatalChart;
  line: string;
  selectedBodyKey?: string;
};

export function NatalShareCard({ chart, line, selectedBodyKey = 'sun' }: Props) {
  const cardRef = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const body = chart.bodies[selectedBodyKey] ?? chart.bodies.sun ?? Object.values(chart.bodies)[0];
  const safeLine = line.trim();
  const timeUnknown = !!chart.meta?.time_unknown;

  const share = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const uri = await captureRef(cardRef, {
        format: 'png',
        quality: 0.95,
        width: 1080,
        height: 1350,
        result: 'tmpfile',
      });
      await Share.share(Platform.OS === 'ios' ? { url: uri } : { message: safeLine, url: uri });
    } catch {
      setError(t('paylas.hata'));
    } finally {
      setBusy(false);
    }
  };

  if (!safeLine || !body) return null;

  return (
    <View style={styles.wrap}>
      <View ref={cardRef} collapsable={false} style={styles.card}>
        <ArtSlot id="editorial-share" strength="strong" />
        <View style={styles.body}>
          <View style={styles.header}>
            <View>
              <Eyebrow style={styles.eyebrow}>{t('paylas.natalBaslik')}</Eyebrow>
              <Text style={styles.title}>{t('paylas.natalKisisel')}</Text>
            </View>
            {timeUnknown ? <Text style={styles.estimate}>{t('ob.reveal.tahmini')}</Text> : null}
          </View>

          <View style={styles.wheel} pointerEvents="none">
            <NatalChartWheel chart={chart} compact selectedKey={body.key} />
          </View>

          <View style={styles.anchor}>
            <Eyebrow style={styles.anchorLabel}>{t('paylas.seciliGosterge')}</Eyebrow>
            <Text style={styles.anchorValue}>
              {body.name_tr} · {body.sign_tr} · {body.degree_in_sign.toFixed(1)}°
            </Text>
          </View>
          <Text style={styles.line} numberOfLines={4} adjustsFontSizeToFit minimumFontScale={0.74}>
            {safeLine}
          </Text>
        </View>

        <View style={styles.footer}>
          {/* i18n-ignore: marka adı çevrilmiyor */}
          <Text style={styles.brand}>telve</Text>
          <Text style={styles.disclaimer}>{t('ortak.eglenceAmacli')}</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={share} disabled={busy} style={styles.button}>
        <Text style={styles.buttonLabel}>{busy ? t('paylas.hazirlaniyor') : t('paylas.buton')}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxl },
  card: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    aspectRatio: 4 / 5,
    overflow: 'hidden',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.cizgi,
    backgroundColor: color.cezve,
  },
  body: { flex: 1, padding: space.lg, paddingBottom: 0 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.md },
  eyebrow: { color: color.bakir },
  title: { ...type.title, color: color.porselen, fontSize: 24, lineHeight: 29, marginTop: 2 },
  estimate: { ...type.eyebrow, color: color.bakir, marginTop: 2 },
  wheel: { flex: 1, minHeight: 0, marginHorizontal: -space.md, marginTop: -space.md, justifyContent: 'center' },
  anchor: { borderTopWidth: 1, borderTopColor: color.cizgi, paddingTop: space.sm },
  anchorLabel: { color: color.kulKoyu },
  anchorValue: { ...type.dataStrong, color: color.cini, marginTop: 2 },
  line: { ...type.oracle, color: color.porselen, fontSize: 16, lineHeight: 22, marginTop: space.sm, minHeight: 42 },
  footer: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  brand: { ...type.dataStrong, color: color.bakir, letterSpacing: 2 },
  disclaimer: { ...type.data, color: color.kulKoyu, fontSize: 10 },
  button: {
    minHeight: 48,
    marginTop: space.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.cizgi,
    borderRadius: radius.md,
  },
  buttonLabel: { ...type.dataStrong, color: color.bakir, letterSpacing: 1 },
  error: { ...type.data, color: color.kiremit, fontSize: 11, marginTop: space.sm },
});
