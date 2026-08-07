import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import * as purchases from '@/lib/purchases';
import { useDraft } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';

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
// Yedek gösterim: mağaza fiyatları yüklenene kadar (veya Expo Go'da native
// modül yokken) ekran boş kalmasın. Gerçek fiyat her zaman mağazadan gelir —
// koda yazılmış fiyat mağaza kuralına aykırı ve TR'de zamla birlikte yanlış olur.
const YEDEK_PLANLAR = [
  { key: 'yearly', title: 'Yıllık', price: '—', per: 'yılda', badge: 'en avantajlı' },
  { key: 'monthly', title: 'Aylık', price: '—', per: 'ayda', badge: null },
];

function planBasligi(period: string | null): { title: string; per: string } {
  if (period === 'P1Y') return { title: 'Yıllık', per: 'yılda' };
  if (period === 'P1M') return { title: 'Aylık', per: 'ayda' };
  if (period === 'P1W') return { title: 'Haftalık', per: 'haftada' };
  return { title: 'Abonelik', per: '' };
}

const INCLUDED = [
  'Sınırsız kahve falı ve tarot',
  'Gerçek doğum haritası çözümü',
  'Kişisel transit uyarıları',
  'Reklamsız',
];

export default function Paywall() {
  const router = useRouter();
  const qc = useQueryClient();
  const finish = useDraft((s) => s.finish);
  const [plans, setPlans] = useState(YEDEK_PLANLAR);
  const [plan, setPlan] = useState<string>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let iptal = false;
    purchases.getPlans().then((p) => {
      if (iptal || p.length === 0) return;
      const list = p.map((x) => {
        const { title, per } = planBasligi(x.period);
        return {
          key: x.identifier,
          title,
          per,
          price: x.priceString,
          badge: x.period === 'P1Y' ? 'en avantajlı' : null,
        };
      });
      setPlans(list);
      setPlan(list[0].key);
    });
    return () => {
      iptal = true;
    };
  }, []);

  const go = async () => {
    setBusy(true);
    setError(null);
    const res = await purchases.purchase(plan);
    setBusy(false);
    if (res.ok) {
      // Hak sunucuda RevenueCat webhook'uyla açılıyor; /v1/me önbelleğini
      // düşürüp güncel tier'ı çekiyoruz.
      qc.invalidateQueries({ queryKey: ['me'] });
      finish();
      router.replace('/(tabs)');
      return;
    }
    if (res.cancelled) return;         // iptal hata değil, sessizce kal
    setError(res.message);
  };

  const skip = () => {
    finish();
    router.replace('/(tabs)');
  };

  const restore = async () => {
    setBusy(true);
    const ok = await purchases.restore();
    setBusy(false);
    if (ok) {
      qc.invalidateQueries({ queryKey: ['me'] });
      finish();
      router.replace('/(tabs)');
    } else {
      setError('Geri yüklenecek bir abonelik bulamadım.');
    }
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
        {plans.map((p) => {
          const on = plan === p.key;
          return (
            <Pressable key={p.key} onPress={() => setPlan(p.key)} style={[styles.plan, on && styles.planOn]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.planTitle}>{p.title}</Text>
                <Text style={styles.planPer}>{p.per}</Text>
              </View>
              <Text style={[styles.planPrice, on && { color: color.bakir }]}>{p.price}</Text>
              {p.badge && <Eyebrow style={styles.badge}>{p.badge}</Eyebrow>}
            </Pressable>
          );
        })}
      </View>

      <Button label="Abone ol" loading={busy} onPress={go} style={{ marginTop: space.lg }} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.terms}>
        Abonelik otomatik yenilenir. Yenilemeden en az 24 saat önce Google Play hesabından
        iptal edebilirsin. Ücret onayladığın anda tahsil edilir. Fal içeriği eğlence
        amaçlıdır; tıbbi, hukuki veya finansal tavsiye yerine geçmez.
      </Text>

      <View style={styles.footerLinks}>
        <Pressable onPress={skip}>
          <Text style={styles.free}>Ücretsiz devam et</Text>
        </Pressable>
        <Pressable onPress={restore}>
          <Text style={styles.free}>Satın alımı geri yükle</Text>
        </Pressable>
      </View>
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
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space.lg,
  },
  free: { ...type.data, color: color.kul },
  error: { ...type.data, color: color.kiremit, fontSize: 12, marginTop: space.md },
});
