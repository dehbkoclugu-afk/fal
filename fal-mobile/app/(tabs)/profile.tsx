import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/Screen';
import { useDraft } from '@/lib/store';
import { color, space, type } from '@/lib/theme';

export default function Profile() {
  const draft = useDraft((s) => s.draft);
  const coins = useDraft((s) => s.coins);

  const rows = [
    { k: 'ad', v: draft.firstName ?? '—' },
    { k: 'doğum', v: draft.birthDate ?? '—' },
    { k: 'saat', v: draft.timeKnown ? draft.birthTime ?? '—' : 'bilinmiyor' },
    { k: 'yer', v: draft.placeName ?? '—' },
    { k: 'ton', v: draft.tone },
    { k: 'jeton', v: String(coins) },
  ];

  return (
    <Screen scroll>
      <Text style={styles.eyebrow}>profil</Text>

      <View style={styles.table}>
        {rows.map((r) => (
          <View key={r.k} style={styles.row}>
            <Text style={styles.k}>{r.k}</Text>
            <Text style={styles.v}>{r.v}</Text>
          </View>
        ))}
      </View>

      {/* Hesap bağlama: değer gösterildikten SONRA öneriliyor, onboarding'de değil */}
      <Pressable style={styles.link}>
        <Text style={styles.linkText}>Google ile hesabımı bağla</Text>
        <Text style={styles.linkNote}>Telefonunu değiştirdiğinde geçmişin kaybolmaz.</Text>
      </Pressable>

      <View style={styles.legal}>
        <Text style={styles.legalText}>
          Uygulamadaki tüm yorumlar eğlence amaçlıdır. Tıbbi, hukuki veya finansal
          tavsiye yerine geçmez.
        </Text>
        <Pressable><Text style={styles.legalLink}>Verilerimi sil</Text></Pressable>
        <Pressable><Text style={styles.legalLink}>Gizlilik politikası</Text></Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul },
  table: { marginTop: space.lg },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: color.cizgi,
  },
  k: { ...type.data, color: color.kulKoyu },
  v: { ...type.dataStrong, color: color.porselen },
  link: { marginTop: space.xl, paddingVertical: space.md },
  linkText: { ...type.bodyStrong, color: color.bakir },
  linkNote: { ...type.data, color: color.kulKoyu, fontSize: 11, marginTop: 2 },
  legal: { marginTop: space.xxl, gap: space.md },
  legalText: { ...type.data, color: color.kulKoyu, fontSize: 11, lineHeight: 17 },
  legalLink: { ...type.data, color: color.kul, fontSize: 12 },
});
