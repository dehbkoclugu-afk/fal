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
import { t } from '@/lib/i18n';

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
    { k: t('profil.dogum'), v: draft.birthDate ?? '—' },
    { k: t('profil.saat'), v: draft.timeKnown ? draft.birthTime ?? '—' : t('profil.bilinmiyor') },
    { k: t('profil.yer'), v: draft.placeName ?? '—' },
    { k: t('profil.ton'), v: me?.tone ?? draft.tone },
    { k: t('profil.jetonSatir'), v: me?.entitlement ? t('ana.sinirsiz') : String(me?.coins ?? 0) },
    { k: t('profil.seri'), v: t('profil.seriGun', { n: me?.streak?.count ?? 0 }) },
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
      t('profil.silOnayBaslik'),
      t('profil.silOnayMetin'),
      [
        { text: t('ortak.vazgec'), style: 'cancel' },
        {
          text: t('profil.sil'),
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
              Alert.alert(t('profil.silinemedi'), t('ortak.baglantiHatasi'));
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
      <Eyebrow style={styles.eyebrow}>{t('profil.eyebrow')}</Eyebrow>

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
        <Text style={styles.linkText}>{t('profil.googleBagla')}</Text>
        <Text style={styles.linkNote}>{t('profil.googleBaglaNot')}</Text>
      </Pressable>

      <View style={styles.legal}>
        <Text style={styles.legalText}>
          Uygulamadaki tüm yorumlar eğlence amaçlıdır. Tıbbi, hukuki veya finansal
          tavsiye yerine geçmez.
        </Text>
        <Pressable onPress={sil} disabled={busy}>
          <Text style={[styles.legalLink, { color: color.kiremit }]}>
            {busy ? t('profil.siliniyor') : t('profil.verileriSil')}
          </Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(GIZLILIK_URL)}>
          <Text style={styles.legalLink}>{t('profil.gizlilik')}</Text>
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
