import React, { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { resetAnonId } from '@/lib/anon';
import { useDraft } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { DILLER, aktifDil, dilSec, t, uygulaYon } from '@/lib/i18n';
import { deleteAllCupPhotos } from '@/lib/cupPhotos';

/**
 * Yasal sayfalar.
 *
 * `public/` altında düz HTML olarak duruyorlar ve web derlemesiyle birlikte
 * yayınlanıyorlar. Uygulama paketine gömülü değiller çünkü Google Play
 * incelemesi gizlilik politikasını TARAYICIDA açıyor: erişilemeyen bir
 * politika bağlantısı doğrudan ret sebebi. Aynı sayfalar mağaza listesinde
 * de bu adreslerle veriliyor.
 */
const YASAL_KOK = 'https://telve.app';
const GIZLILIK_URL = `${YASAL_KOK}/gizlilik.html`;
const KOSULLAR_URL = `${YASAL_KOK}/kosullar.html`;

export default function Profile() {
  const router = useRouter();
  const qc = useQueryClient();
  const draft = useDraft((s) => s.draft);
  const reset = useDraft((s) => s.reset);
  const [busy, setBusy] = useState(false);

  const { data: me } = useQuery({ queryKey: ['me'], queryFn: api.me });

  const rows = [
    { k: t('profil.ad'), v: me?.first_name ?? draft.firstName ?? '—' },
    { k: t('profil.dogum'), v: draft.birthDate ?? '—' },
    { k: t('profil.saat'), v: draft.timeKnown ? draft.birthTime ?? '—' : t('profil.bilinmiyor') },
    { k: t('profil.yer'), v: draft.placeName ?? '—' },
    { k: t('profil.ton'), v: me?.tone ?? draft.tone },
    { k: t('profil.jetonSatir'), v: me?.entitlement ? t('ana.sinirsiz') : String(me?.coins ?? 0) },
    { k: t('profil.seri'), v: t('profil.seriGun', { n: me?.streak?.count ?? 0 }) },
  ];

  /**
   * Dil değişimi.
   *
   * Üç yere birden yazılıyor ve üçü de gerekli: cihaza (açılışta okunuyor),
   * i18n katmanına (ekrandaki metin) ve SUNUCUYA (guardrail'in kriz
   * kaynakları oradan seçiliyor). Sunucuya yazmayı atlamak, kullanıcının
   * arayacağı acil yardım numarasını yanlış ülkeninki bırakır.
   *
   * RTL'e geçişte native'de yeniden başlatma gerekiyor — I18nManager
   * değişikliği çizilmiş ağaca uygulanmıyor. Kullanıcıya bunu söylüyoruz,
   * sessizce yarım dönmüş bir düzen bırakmak yerine.
   */
  const dilDegistir = async (kod: string) => {
    if (kod === aktifDil().code) return;
    const d = dilSec(kod);
    await AsyncStorage.setItem('dil', d.code);
    const yenidenBaslat = uygulaYon(d.rtl);
    try {
      await api.saveProfile({ locale: d.code });
    } catch {
      // Sunucuya yazılamadıysa cihazdaki seçim duruyor; bir sonraki profil
      // kaydında tekrar denenecek (saveProfile dili her zaman gönderiyor).
    }
    qc.invalidateQueries({ queryKey: ['me'] });
    if (yenidenBaslat) Alert.alert(t('profil.dil'), t('profil.dilYenidenBaslat'));
  };

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
              await deleteAllCupPhotos();
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

      {/* Dil seçici yalnızca gerçekten seçenek varken görünüyor. Tek dilli
          kurulumda tek satırlık bir liste göstermek, kullanıcıya işe yaramaz
          bir ayar sunmak olurdu. */}
      {DILLER.length > 1 && (
        <View style={styles.diller}>
          <Eyebrow style={styles.dilBaslik}>{t('profil.dil')}</Eyebrow>
          <View style={styles.dilSatir}>
            {DILLER.map((d) => {
              const secili = d.code === aktifDil().code;
              return (
                <Pressable
                  key={d.code}
                  onPress={() => dilDegistir(d.code)}
                  style={[styles.dilRozet, secili && styles.dilRozetOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: secili }}
                >
                  <Text style={[styles.dilAd, secili && { color: color.bakir }]}>
                    {d.native}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      <View style={styles.legal}>
        <Text style={styles.legalText}>{t('profil.yasalMetin')}</Text>
        <Pressable onPress={sil} disabled={busy}>
          <Text style={[styles.legalLink, { color: color.kiremit }]}>
            {busy ? t('profil.siliniyor') : t('profil.verileriSil')}
          </Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(GIZLILIK_URL)}>
          <Text style={styles.legalLink}>{t('profil.gizlilik')}</Text>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(KOSULLAR_URL)}>
          <Text style={styles.legalLink}>{t('profil.kosullar')}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul },
  table: { marginTop: space.lg },
  row: {
    position: 'relative',
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    marginBottom: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: color.cizgi,
    backgroundColor: color.cezve,
  },
  k: { ...type.data, color: color.kulKoyu },
  v: { ...type.dataStrong, color: color.porselen },
  diller: { marginTop: space.xl },
  dilBaslik: { ...type.eyebrow, color: color.kulKoyu },
  dilSatir: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  dilRozet: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: color.cizgi,
    borderRadius: 999,
  },
  dilRozetOn: { borderColor: color.bakir, backgroundColor: color.cezveUst },
  dilAd: { ...type.data, color: color.kul },
  legal: { marginTop: space.xxl, gap: space.md },
  legalText: { ...type.data, color: color.kulKoyu, fontSize: 11, lineHeight: 17 },
  legalLink: { ...type.data, color: color.kul, fontSize: 12 },
});
