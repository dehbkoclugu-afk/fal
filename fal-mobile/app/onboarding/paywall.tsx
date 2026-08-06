import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { useDraft } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';

/**
 * Onboarding paywall'ı.
 *
 * TR pazarı için SOFT paywall: kapatılabilir. Sebep: TR'de hard paywall
 * toplam geliri genelde düşürüyor, çünkü reklam + jeton geliri abonelikten
 * büyük. MENA/ABD'de tersi. Bu yüzden variant remote config'ten gelmeli ve
 * ülkeye göre değişmeli — kod deploy'u gerektiren A/B test ölü A/B testtir.
 *
 * Fiyat ve süre bilgisi açıkça yazılı: hem mağaza kuralı hem iade önlemi.
 */
const PLANS = [
  { key: 'yearly', title: 'Yıllık', price: '999₺', per: 'ayda ~83₺', badge: '%58 tasarruf' },
  { key: 'monthly', title: 'Aylık', price: '199₺', per: 'ayda', badge: null },
] as const;

const INCLUDED = [
  'Sınırsız kahve falı ve tarot',
  'Gerçek doğum haritası çözümü',
  'Kişisel transit uyarıları',
  'Reklamsız',
];

export default function Paywall() {
  const router = useRouter();
  const finish = useDraft((s) => s.finish);
  const [plan, setPlan] = useState<string>('yearly');

  const go = () => {
    // TODO: react-native-purchases → Purchases.purchasePackage(...)
    finish();
    router.replace('/(tabs)');
  };

  const skip = () => {
    finish();
    router.replace('/(tabs)');
  };

  return (
    <Screen scroll>
      <Pressable onPress={skip} style={styles.close} accessibilityRole="button" accessibilityLabel="Kapat">
        <Text style={styles.closeText}>kapat</Text>
      </Pressable>

      <Text style={styles.title}>Falın hazır</Text>
      <Text style={styles.sub}>
        Ücretsiz kullanmaya devam edebilirsin. Abone olursan bekleme ve jeton sınırı kalkar.
      </Text>

      <View style={styles.list}>
        {INCLUDED.map((i) => (
          <View key={i} style={styles.item}>
            <View style={styles.dot} />
            <Text style={styles.itemText}>{i}</Text>
          </View>
        ))}
      </View>

      <View style={styles.plans}>
        {PLANS.map((p) => {
          const on = plan === p.key;
          return (
            <Pressable key={p.key} onPress={() => setPlan(p.key)} style={[styles.plan, on && styles.planOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{p.title}</Text>
                <Text style={styles.planPer}>{p.per}</Text>
              </View>
              <Text style={[styles.planPrice, on && { color: color.bakir }]}>{p.price}</Text>
              {p.badge && <Text style={styles.badge}>{p.badge}</Text>}
            </Pressable>
          );
        })}
      </View>

      <Button label="Abone ol" onPress={go} style={{ marginTop: space.lg }} />

      <Text style={styles.terms}>
        Abonelik otomatik yenilenir. Yenilemeden en az 24 saat önce Google Play hesabından
        iptal edebilirsin. Ücret onayladığın anda tahsil edilir.
      </Text>
      <Pressable onPress={skip} style={{ marginTop: space.lg }}>
        <Text style={styles.free}>Ücretsiz devam et</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  close: { alignSelf: 'flex-end', padding: space.sm },
  closeText: { ...type.data, color: color.kulKoyu },
  title: { ...type.title, color: color.porselen, marginTop: space.md },
  sub: { ...type.body, color: color.kul, marginTop: space.sm },
  list: { marginTop: space.xl, gap: space.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: color.bakir },
  itemText: { ...type.body, color: color.porselen },
  plans: { marginTop: space.xl, gap: space.md },
  plan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.cizgi,
    backgroundColor: color.cezve,
  },
  planOn: { borderColor: color.bakir, backgroundColor: color.cezveUst },
  planTitle: { ...type.bodyStrong, color: color.porselen },
  planPer: { ...type.data, color: color.kulKoyu, fontSize: 11 },
  planPrice: { ...type.dataStrong, color: color.porselen, fontSize: 18 },
  badge: { ...type.eyebrow, color: color.cini, fontSize: 9 },
  terms: { ...type.data, color: color.kulKoyu, fontSize: 10, lineHeight: 16, marginTop: space.lg },
  free: { ...type.data, color: color.kul, textAlign: 'center' },
});
