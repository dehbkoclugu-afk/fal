import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Eyebrow } from '@/components/Eyebrow';
import { TelveRing } from '@/components/TelveRing';
import type { DreamMoon, Transit } from '@/lib/api';
import { color, radius, space, type } from '@/lib/theme';
import { t, tarih } from '@/lib/i18n';

const BODY_KEYS = {
  sun: 'gezegen.sun', moon: 'gezegen.moon', mercury: 'gezegen.mercury',
  venus: 'gezegen.venus', mars: 'gezegen.mars', jupiter: 'gezegen.jupiter',
  saturn: 'gezegen.saturn', uranus: 'gezegen.uranus', neptune: 'gezegen.neptune',
  pluto: 'gezegen.pluto',
} as const;

const bodyName = (key: string) =>
  key in BODY_KEYS ? t(BODY_KEYS[key as keyof typeof BODY_KEYS]) : key;

export function DreamSkyPanel({ moon, transits, night, mode = 'dream' }: { moon: DreamMoon; transits: Transit[]; night: string; mode?: 'dream' | 'daily' }) {
  return (
    <View style={styles.panel}>
      <Eyebrow style={styles.label}>{t(mode === 'daily' ? 'gunluk.bugununGokyuzu' : 'ruya.geceninGokyuzu')}</Eyebrow>
      <View style={styles.hero}>
        <View style={styles.moonWrap}>
          <TelveRing size={76} value={Math.max(0.03, moon.aydinlanma ?? 0)} mode="ledger" breathing={false} />
          <Text style={styles.moonGlyph}>☾</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.moonTitle}>{moon.burc} · {moon.faz}</Text>
          <Text style={styles.night}>{tarih(`${night}T12:00:00Z`)}</Text>
          <Text style={styles.degree}>{moon.derece.toFixed(1)}° · %{Math.round((moon.aydinlanma ?? 0) * 100)} {t('ruya.aydinlik')}</Text>
        </View>
      </View>

      {transits.length ? (
        <View style={styles.transits}>
          <Eyebrow style={styles.transitLabel}>{t('ruya.etkinGostergeler')}</Eyebrow>
          {transits.slice(0, 3).map((tr) => (
            <View key={tr.code} style={styles.transitRow}>
              <View style={[styles.strength, { opacity: 0.3 + tr.severity * 0.7 }]} />
              <Text style={styles.transitText}>
                {bodyName(tr.transit)} {tr.aspect_tr} {bodyName(tr.natal)}
              </Text>
              <Text style={styles.orb}>{tr.orb.toFixed(1)}°</Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.empty}>{t('ruya.transitYok')}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: space.lg, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: color.cizgi, backgroundColor: color.cezve },
  label: { ...type.eyebrow, color: color.cini },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.md },
  moonWrap: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  moonGlyph: { position: 'absolute', color: color.porselen, fontSize: 28 },
  moonTitle: { ...type.bodyStrong, color: color.porselen },
  night: { ...type.data, color: color.kul, marginTop: 3 },
  degree: { ...type.data, color: color.kulKoyu, fontSize: 10, marginTop: 3 },
  transits: { marginTop: space.lg, borderTopWidth: 1, borderTopColor: color.cizgi, paddingTop: space.md },
  transitLabel: { ...type.eyebrow, color: color.kulKoyu, marginBottom: space.xs },
  transitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  strength: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.cini },
  transitText: { ...type.data, color: color.porselen, flex: 1 },
  orb: { ...type.data, color: color.kulKoyu, fontSize: 10 },
  empty: { ...type.data, color: color.kulKoyu, fontSize: 10, marginTop: space.md },
});
