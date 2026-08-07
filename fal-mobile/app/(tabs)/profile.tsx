import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { resetAnonId } from '@/lib/anon';
import { useDraft } from '@/lib/store';
import { color, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';

const GIZLILIK_URL = 'https://telve.app/gizlilik';

export default function Profile() {
  const router = useRouter();
  const qc = useQueryClient();
  const draft = useDraft((s) => s.draft);
  const reset = useDraft((s) => s.reset);
  const [busy, setBusy] = useState(false);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });

  const rows = [
    { k: 'ad', v: me?.first_name ?? draft.firstName ?? '—' },
    { k: 'doğum', v: draft.birthDate ?? '—' },
    { k: 'saat', v: draft.timeKnown ? draft.birthTime ?? '—' : 'bilinmiyor' },
    { k: 'yer', v: draft.placeName ?? '—' },
    { k: 'ton', v: me?.tone ?? draft.tone },
    { k: 'jeton', v: me?.entitlement ? 'sınırsız' : String(me?.coins ?? 0) },
    { k: 'seri', v: `${me?.streak?.count ?? 0} gün` },
  ];

  /**
   * KVKK silme akışı. Çalışır durumda olmak zorunda — "sonra ekleriz"
   * listesine giremez.
   *
   * Sunucu kaydı silinmiş işaretleyip anon_id'yi serbest bırakıyor; burada
   * cihazdaki kimliği ve yerel taslağı da temizliyoruz, yoksa aynı cihaz
   * silinmiş kullanıcının verisini yerelden göstermeye devam eder.
   */
  const sil = () => {
    Alert.alert(
      'Verilerin silinsin mi?',
      'Doğum bilgilerin, fal geçmişin ve tahmin defterin kalıcı olarak silinir. ' +
        'Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await api.deleteAccount();
              await resetAnonId();
              reset();
              qc.clear();
              router.replace('/onboarding/name');
            } catch {
              Alert.alert('Silinemedi', 'Bağlantını kontrol edip tekrar dener misin?');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <Screen scroll>
      <Eyebrow style={styles.eyebrow}>profil</Eyebrow>

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
        <Pressable onPress={sil} disabled={busy}>
          <Text style={[styles.legalLink, { color: color.kiremit }]}>
            {busy ? 'siliniyor…' : 'Verilerimi sil'}
          </Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(GIZLILIK_URL)}>
          <Text style={styles.legalLink}>Gizlilik politikası</Text>
        </Pressable>
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
