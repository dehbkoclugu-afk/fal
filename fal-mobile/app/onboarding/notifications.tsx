import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { color, space, type } from '@/lib/theme';

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

  // TODO: /v1/me/next-transit ucundan çek. Şimdilik yaklaşık gösterim.
  const next = { date: '14 Ağustos', what: 'Merkür iletişim evine giriyor' };

  const ask = async () => {
    setBusy(true);
    try {
      await Notifications.requestPermissionsAsync();
    } finally {
      setBusy(false);
      router.push('/onboarding/paywall');
    }
  };

  return (
    <Screen>
      <Text style={styles.eyebrow}>Yaklaşan</Text>
      <Text style={styles.q}>Haritanda bir hareket var</Text>

      <View style={styles.card}>
        <Text style={styles.date}>{next.date}</Text>
        <Text style={styles.what}>{next.what}</Text>
        <Text style={styles.note}>
          Bu, senin doğum haritana göre hesaplandı — genel burç yorumu değil.
        </Text>
      </View>

      <Text style={styles.body}>
        Böyle günler yaklaştığında haber vereyim mi? Günde en fazla iki bildirim
        gönderiyorum, gece hiç göndermiyorum.
      </Text>

      <View style={styles.spacer} />
      <Button label="Haber ver" loading={busy} onPress={ask} />
      <Button
        label="Şimdi değil"
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
