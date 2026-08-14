import React, { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { ArtSlot } from '@/components/ArtSlot';
import { Button } from '@/components/Button';
import { Eyebrow } from '@/components/Eyebrow';
import { Screen } from '@/components/Screen';
import { api } from '@/lib/api';
import { getAnonId } from '@/lib/anon';
import { t } from '@/lib/i18n';
import { paywallTitleKey, sortStorePlans, type StoreSurfaceState } from '@/lib/paywallModel';
import * as purchases from '@/lib/purchases';
import { useDraft } from '@/lib/store';
import { color, radius, space, type } from '@/lib/theme';

const VARYANT = 'soft_yillik_stateful_v2';
const GIZLILIK_URL = 'https://telve.app/gizlilik.html';
const KOSULLAR_URL = 'https://telve.app/kosullar.html';

type PaywallPlan = {
  key: string;
  title: string;
  price: string;
  per: string;
  renewal: string;
  badge: string | null;
};

function planBasligi(period: string | null): { title: string; per: string } {
  if (period === 'P1Y') return { title: t('ob.paywall.yillik'), per: t('ob.paywall.yildaBir') };
  if (period === 'P1M') return { title: t('ob.paywall.aylik'), per: t('ob.paywall.aydaBir') };
  if (period === 'P1W') return { title: t('ob.paywall.haftalik'), per: t('ob.paywall.haftadaBir') };
  return { title: t('ob.paywall.abonelik'), per: '' };
}

const premiumKapsam = () => [
  t('ob.paywall.natal'),
  t('ob.paywall.transit'),
  t('ob.paywall.reklamsiz'),
];

const ucretsizKapsam = () => [
  t('ob.paywall.ucretsizJeton'),
  t('ob.paywall.ucretsizGunluk'),
  t('ob.paywall.ucretsizGecmis'),
];

export default function Paywall() {
  const router = useRouter();
  const { height: screenHeight } = useWindowDimensions();
  const qc = useQueryClient();
  const finish = useDraft((s) => s.finish);
  const [plans, setPlans] = useState<PaywallPlan[]>([]);
  const [plan, setPlan] = useState<string | null>(null);
  const [storeState, setStoreState] = useState<StoreSurfaceState>('loading');
  const [busy, setBusy] = useState(false);
  const [purchaseState, setPurchaseState] = useState<'idle' | 'purchasing' | 'purchase-error' | 'success'>('idle');
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});
  const buildProfile = (Constants.expoConfig?.extra as any)?.buildProfile ?? 'development';

  useEffect(() => {
    api.paywallEvent('onboarding', VARYANT, 'view');
  }, []);

  const loadPlans = useCallback(async () => {
    setStoreState('loading');
    setPurchaseState('idle');
    setPlanErrors({});
    const configured = await purchases.configure(await getAnonId());
    const result = configured
      ? await purchases.getPlans()
      : { status: 'misconfigured' as const, plans: [] };
    if (result.status !== 'ready') {
      setPlans([]);
      setPlan(null);
      setStoreState(result.status);
      return;
    }
    const list = sortStorePlans(result.plans).map((item) => {
      const { title, per } = planBasligi(item.period);
      return {
        key: item.identifier,
        title,
        per,
        price: item.priceString,
        renewal: t('ob.paywall.toplamYenileme', { fiyat: item.priceString, donem: per }),
        badge: item.period === 'P1Y' ? t('ob.paywall.enAvantajli') : null,
      };
    });
    setPlans(list);
    setPlan(list[0]?.key ?? null);
    setStoreState(list.length ? 'ready' : 'empty');
  }, []);

  useEffect(() => {
    loadPlans().catch(() => setStoreState('offline'));
  }, [loadPlans]);

  const skip = () => {
    api.paywallEvent('onboarding', VARYANT, 'dismiss');
    finish();
    router.replace('/(tabs)');
  };

  const buy = async () => {
    if (storeState !== 'ready' || !plan) return;
    setBusy(true);
    setPurchaseState('purchasing');
    setPlanErrors((current) => ({ ...current, [plan]: '' }));
    const result = await purchases.purchase(plan);
    setBusy(false);
    if (result.ok) {
      setPurchaseState('success');
      api.paywallEvent('onboarding', VARYANT, 'purchase', plans.find((p) => p.key === plan)?.price);
      qc.invalidateQueries({ queryKey: ['me'] });
      finish();
      router.replace('/(tabs)');
      return;
    }
    if (!result.cancelled) {
      setPurchaseState('purchase-error');
      setPlanErrors((current) => ({ ...current, [plan]: result.message }));
    } else {
      setPurchaseState('idle');
    }
  };

  const restore = async () => {
    setBusy(true);
    const ok = await purchases.restore();
    setBusy(false);
    if (ok) {
      qc.invalidateQueries({ queryKey: ['me'] });
      finish();
      router.replace('/(tabs)');
      return;
    }
    const target = plan ?? 'store';
    setPlanErrors((current) => ({ ...current, [target]: t('ob.paywall.geriYuklenemedi') }));
  };

  const retryable = storeState === 'offline' || storeState === 'empty';
  const testMode = storeState === 'misconfigured' && buildProfile !== 'production';

  return (
    <Screen scroll>
      <Pressable onPress={skip} style={styles.close} accessibilityRole="button" accessibilityLabel={t('ortak.kapatEtiket')}>
        <Text style={styles.closeText}>{t('ortak.kapat')}</Text>
      </Pressable>

      <View style={[styles.hero, { height: Math.min(180, screenHeight * 0.28) }]}>
        <ArtSlot id="natal" strength="soft" />
        <View style={styles.heroOrb}><Text style={styles.heroGlyph}>☾</Text></View>
      </View>

      {testMode ? <Eyebrow style={styles.testBadge}>{t('ob.paywall.testSurumu')}</Eyebrow> : null}
      <Text style={styles.title}>{t(paywallTitleKey(storeState))}</Text>
      <Text style={styles.sub}>
        {storeState === 'ready' || storeState === 'loading'
          ? t('ob.paywall.altBaslik')
          : t('ob.paywall.ucretsizAltBaslik')}
      </Text>

      <Eyebrow style={styles.blockTitle}>{t('ob.paywall.ucretsizHaklar')}</Eyebrow>
      <BenefitList items={ucretsizKapsam()} />
      <Eyebrow style={styles.blockTitle}>{t('ob.paywall.premiumHaklar')}</Eyebrow>
      <BenefitList items={premiumKapsam()} />

      {storeState === 'loading' ? <PlanSkeletons /> : null}

      {storeState !== 'loading' && storeState !== 'ready' ? (
        <View style={styles.storeCard}>
          <Text style={styles.storeState}>
            {storeState === 'offline'
              ? t('ob.paywall.cevrimdisi')
              : storeState === 'empty'
                ? t('ob.paywall.planYok')
                : t('ob.paywall.magazaHazirDegil')}
          </Text>
          {retryable ? (
            <Pressable onPress={loadPlans} accessibilityRole="button" style={styles.retry}>
              <Text style={styles.retryText}>{t('ortak.tekrarDeneButon')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.plans}>
        {plans.map((item) => {
          const selected = plan === item.key;
          return (
            <View key={item.key}>
              <Pressable
                onPress={() => setPlan(item.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[styles.plan, selected && styles.planOn]}
              >
                <View style={styles.radio}>{selected ? <View style={styles.radioOn} /> : null}</View>
                <View style={styles.planCopy}>
                  <Text style={styles.planTitle}>{item.title}</Text>
                  <Text style={styles.planPer}>{item.price} · {item.per}</Text>
                  <Text style={styles.renewal}>{item.renewal}</Text>
                </View>
                {item.badge ? <Eyebrow style={styles.badge}>{item.badge}</Eyebrow> : null}
              </Pressable>
              {planErrors[item.key] ? <Text accessibilityLiveRegion="assertive" style={styles.planError}>{planErrors[item.key]}</Text> : null}
            </View>
          );
        })}
      </View>

      <Button
        label={storeState === 'ready' ? t('ob.paywall.aboneOl') : t('ob.paywall.ucretsizDevam')}
        loading={busy || purchaseState === 'purchasing'}
        disabled={storeState === 'loading' || (storeState === 'ready' && !plan)}
        onPress={storeState === 'ready' ? buy : skip}
        style={{ marginTop: space.lg }}
      />

      <Text style={styles.coinNote}>{t('ob.paywall.jetonNot')}</Text>
      <View style={styles.footerLinks}>
        {storeState === 'ready' ? <FooterLink label={t('ob.paywall.ucretsizDevam')} onPress={skip} /> : null}
        <FooterLink label={t('ob.paywall.geriYukle')} onPress={restore} disabled={busy || storeState === 'misconfigured'} />
        <FooterLink label={t('profil.kosullar')} onPress={() => Linking.openURL(KOSULLAR_URL)} />
        <FooterLink label={t('profil.gizlilik')} onPress={() => Linking.openURL(GIZLILIK_URL)} />
      </View>
      <Text style={styles.terms}>{t('ob.paywall.sartlar')}</Text>
      {planErrors.store ? <Text accessibilityLiveRegion="assertive" style={styles.planError}>{planErrors.store}</Text> : null}
    </Screen>
  );
}

function BenefitList({ items }: { items: string[] }) {
  return <View style={styles.list}>{items.map((item) => (
    <View key={item} style={styles.item}><View style={styles.dot} /><Text style={styles.itemText}>{item}</Text></View>
  ))}</View>;
}

function PlanSkeletons() {
  return <View style={styles.plans} accessibilityLabel={t('ob.paywall.magazaBaglaniliyor')}>
    {[0, 1].map((key) => <View key={key} style={styles.skeleton}><View style={styles.skeletonLine} /><View style={styles.skeletonShort} /></View>)}
  </View>;
}

function FooterLink({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="link" style={styles.footerLink}>
    <Text style={[styles.free, disabled && styles.disabled]}>{label}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  close: { alignSelf: 'flex-end', minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  closeText: { ...type.dataStrong, color: color.kul },
  hero: { position: 'relative', overflow: 'hidden', borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  heroOrb: { width: 76, height: 76, borderRadius: 38, borderWidth: 1, borderColor: color.bakir, backgroundColor: 'rgba(22,16,14,0.62)', alignItems: 'center', justifyContent: 'center' },
  heroGlyph: { color: color.porselen, fontSize: 38 },
  testBadge: { color: color.cini, marginTop: space.md },
  title: { ...type.title, color: color.porselen, marginTop: space.md },
  sub: { ...type.body, color: color.kul, marginTop: space.sm },
  blockTitle: { ...type.eyebrow, color: color.bakir, marginTop: space.xl },
  list: { marginTop: space.sm, gap: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: color.bakir },
  itemText: { ...type.body, color: color.porselen, flex: 1 },
  plans: { marginTop: space.xl, gap: space.md },
  storeCard: { marginTop: space.xl, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: color.cizgi, backgroundColor: color.cezve },
  storeState: { ...type.body, color: color.kul },
  retry: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center', marginTop: space.sm },
  retryText: { ...type.dataStrong, color: color.bakir },
  plan: { minHeight: 116, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, borderRadius: radius.md, borderWidth: 1, borderColor: color.cizgi, backgroundColor: color.cezve },
  planOn: { borderColor: color.bakir, backgroundColor: color.cezveUst },
  planCopy: { flex: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: color.kul, alignItems: 'center', justifyContent: 'center' },
  radioOn: { width: 10, height: 10, borderRadius: 5, backgroundColor: color.bakir },
  planTitle: { ...type.bodyStrong, color: color.porselen },
  planPer: { ...type.dataStrong, color: color.bakir, marginTop: 3 },
  renewal: { ...type.data, color: color.kulKoyu, fontSize: 11, marginTop: 4 },
  badge: { color: color.cini, fontSize: 9, alignSelf: 'flex-start' },
  planError: { ...type.data, color: color.kiremit, fontSize: 12, marginTop: space.sm },
  skeleton: { height: 116, padding: space.lg, borderRadius: radius.md, backgroundColor: color.cezve, justifyContent: 'center', gap: space.md },
  skeletonLine: { height: 14, width: '58%', borderRadius: 7, backgroundColor: color.cezveUst },
  skeletonShort: { height: 10, width: '35%', borderRadius: 5, backgroundColor: color.cizgi },
  coinNote: { ...type.data, color: color.kul, fontSize: 11, lineHeight: 17, marginTop: space.md },
  footerLinks: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, marginTop: space.lg },
  footerLink: { minHeight: 44, justifyContent: 'center' },
  free: { ...type.data, color: color.kul },
  disabled: { opacity: 0.45 },
  terms: { ...type.data, color: color.kulKoyu, fontSize: 11, lineHeight: 17, marginTop: space.md },
});
