import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import * as purchases from '@/lib/purchases';
import { useDraft } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';
import { Eyebrow } from '@/components/Eyebrow';
import { t } from '@/lib/i18n';

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
// Paywall varyantı. Remote config'ten sürülebilir olmalı — kod deploy'u
// gerektiren A/B test pratikte ölü A/B testtir (bkz. fal-mobile/README).
const VARYANT = 'soft_yillik_one_v1';

// Fonksiyon, sabit değil: modül düzeyinde t() çağırmak dili içe aktarma
// anında dondurur (bkz. reading/[id].tsx'teki not).
const yedekPlanlar = () => [
  { key: 'yearly', title: t('ob.paywall.yillik'), price: '—', per: t('ob.paywall.yildaBir'), badge: t('ob.paywall.enAvantajli') },
  { key: 'monthly', title: t('ob.paywall.aylik'), price: '—', per: t('ob.paywall.aydaBir'), badge: null },
];

function planBasligi(period: string | null): { title: string; per: string } {
  if (period === 'P1Y') return { title: t('ob.paywall.yillik'), per: t('ob.paywall.yildaBir') };
  if (period === 'P1M') return { title: t('ob.paywall.aylik'), per: t('ob.paywall.aydaBir') };
  if (period === 'P1W') return { title: t('ob.paywall.haftalik'), per: t('ob.paywall.haftadaBir') };
  return { title: t('ob.paywall.abonelik'), per: '' };
}

// Kapsam katmana göre değişiyor. Tek bir liste gösterip her plana
// "sınırsız" demek Yıldız'da YANLIŞ olur: o katman ayda 10 fal veriyor.
// Yanlış vaat bu kategoride iade dalgası ve 1 yıldız yorum demek — mağaza
// kuralı da abonelik kapsamının açıkça yazılmasını istiyor.
const ortakKapsam = () => [
  t('ob.paywall.natal'),
  t('ob.paywall.transit'),
  t('ob.paywall.reklamsiz'),
];

/** Plan anahtarından kapsam satırlarını türetir. */
function kapsam(key: string): string[] {
  const yillik = /year|yil|yıl|annual/i.test(key);
  const ust = yillik || /fate|kader|unlimited/i.test(key);
  return [ust ? t('ob.paywall.sinirsizFal') : t('ob.paywall.aylik10'),
          ...ortakKapsam()];
}

export default function Paywall() {
  const router = useRouter();
  const qc = useQueryClient();
  const finish = useDraft((s) => s.finish);
  const [plans, setPlans] = useState(yedekPlanlar);
  const [plan, setPlan] = useState<string>('yearly');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Huni ölçümü: görüntülenme, kapatma ve satın alma ayrı ayrı işaretleniyor.
  useEffect(() => {
    api.paywallEvent('onboarding', VARYANT, 'view');
  }, []);

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
          badge: x.period === 'P1Y' ? t('ob.paywall.enAvantajli') : null,
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
      api.paywallEvent('onboarding', VARYANT, 'purchase',
        plans.find((p) => p.key === plan)?.price);
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
    api.paywallEvent('onboarding', VARYANT, 'dismiss');
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
      setError(t('ob.paywall.geriYuklenemedi'));
    }
  };

  return (
    <Screen scroll>
      <Pressable onPress={skip} style={styles.close} accessibilityRole="button" accessibilityLabel={t('ortak.kapatEtiket')}>
        <Text style={styles.closeText}>{t('ortak.kapat')}</Text>
      </Pressable>

      <Text style={styles.title}>{t('ob.paywall.baslik')}</Text>
      <Text style={styles.sub}>{t('ob.paywall.altBaslik')}</Text>

      <View style={styles.list}>
        {kapsam(plan).map((i) => (
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

      <Button label={t('ob.paywall.aboneOl')} loading={busy} onPress={go} style={{ marginTop: space.lg }} />
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.terms}>{t('ob.paywall.sartlar')}</Text>

      <View style={styles.footerLinks}>
        <Pressable onPress={skip}>
          <Text style={styles.free}>{t('ob.paywall.ucretsizDevam')}</Text>
        </Pressable>
        <Pressable onPress={restore}>
          <Text style={styles.free}>{t('ob.paywall.geriYukle')}</Text>
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
