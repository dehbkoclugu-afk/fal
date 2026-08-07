import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { color, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { t, tarih } from '@/lib/i18n';



/**
 * Bildirim izni.
 *
 * KRİTİK: İzni istemeden ÖNCE somut bir değer gösteriyoruz. "Bildirimlere izin
 * ver" diye sorulduğunda opt-in ~%40; "şu tarihte haritanda şu hareket var,
 * haber verelim mi" diye sorulduğunda ~%70. Sistem dialogu ancak kullanıcı
 * buradaki butona bastıktan sonra açılıyor — reddedilen sistem izni geri
 * alınamaz, o yüzden tek şansı boşa harcamıyoruz.
 *
 * Bu ekranın gösterdiği tarih gerçek olmalı: backend'in transit motorundan
 * (astro.next_notable_transits) gelen ilk kayda değer transit.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // Gerçek transit: bu ekranın ikna gücü verinin gerçek olmasından geliyor.
  const { data } = useQuery({
    queryKey: ['next-transit'],
    queryFn: api.nextTransit,
    retry: 1,
  });
  const transit = data?.transit;

  const ask = async () => {
    setBusy(true);
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status === 'granted') {
        // Token olmadan izin tek başına işe yaramaz; backend kime
        // göndereceğini bilemez.
        const token = (await Notifications.getExpoPushTokenAsync()).data;
        await api.registerPush(token, new Date().getHours());
      }
    } catch {
      // İzin/token alınamazsa akış durmaz — onboarding'i tıkamak daha pahalı.
    } finally {
      setBusy(false);
      router.push('/onboarding/paywall');
    }
  };

  return (
    <Screen>
      <Eyebrow style={styles.eyebrow}>{t('ob.bildirim.eyebrow')}</Eyebrow>
      <Text style={styles.q}>{t('ob.bildirim.baslik')}</Text>

      <View style={styles.card}>
        {transit ? (
          <>
            <Eyebrow style={styles.date}>{tarih(transit.exact_at)}</Eyebrow>
            <Text style={styles.what}>{transit.metin}</Text>
            <Text style={styles.note}>{t('ob.bildirim.hesaplandi')}</Text>
          </>
        ) : (
          <>
            <Eyebrow style={styles.date}>{t('ob.bildirim.yaklasan')}</Eyebrow>
            <Text style={styles.what}>{t('ob.bildirim.hareketli')}</Text>
            <Text style={styles.note}>{t('ob.bildirim.hesaplaniyor')}</Text>
          </>
        )}
      </View>

      <Text style={styles.body}>{t('ob.bildirim.aciklama')}</Text>

      <View style={styles.spacer} />
      <Button label={t('ob.bildirim.haberVer')} loading={busy} onPress={ask} />
      <Button
        label={t('ob.bildirim.simdiDegil')}
        variant="ghost"
        style={{ marginTop: space.md }}
        onPress={() => router.push('/onboarding/paywall')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { ...type.eyebrow, color: color.kul, marginTop: space.xl },
  q: { ...type.title, color: color.porselen, marginTop: space.sm },
  card: {
    marginTop: space.xl,
    paddingVertical: space.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: color.cizgi,
  },
  date: { ...type.eyebrow, color: color.bakir },
  what: { ...type.oracleLead, color: color.porselen, marginTop: space.sm },
  note: { ...type.data, color: color.kulKoyu, marginTop: space.md, fontSize: 11 },
  body: { ...type.body, color: color.kul, marginTop: space.xl },
  spacer: { flex: 1 },
});
