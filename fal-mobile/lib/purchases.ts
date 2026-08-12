/**
 * RevenueCat sarmalayıcı.
 *
 * Neden sarmalayıcı: paywall ekranı satın alma SDK'sını doğrudan çağırırsa
 * Expo Go'da (native modül yok) çöker ve onboarding'i hiç test edemezsin.
 * Burada SDK yoksa akış sessizce "satın alma yok" moduna düşüyor.
 *
 * Fiyatlar KODA YAZILMAZ. Mağazadan gelen yerelleştirilmiş fiyat gösterilir:
 * hem mağaza kuralı hem de TR'de fiyat değişiminde uygulama güncellemesi
 * beklememek için.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

export type Plan = {
  identifier: string;
  /** Mağazadan gelen yerelleştirilmiş fiyat, ör. "₺999,00" */
  priceString: string;
  /** month | year | ... */
  period: string | null;
};

type PurchasesModule = typeof import('react-native-purchases');

let mod: PurchasesModule | null | undefined;
let configured = false;
let configuring: Promise<boolean> | null = null;

function load(): PurchasesModule | null {
  if (mod !== undefined) return mod;
  try {
    // Expo Go'da native modül yok; require hatası yakalanıp null'a düşüyor.
    mod = require('react-native-purchases') as PurchasesModule;
  } catch {
    mod = null;
  }
  return mod;
}

export function available(): boolean {
  return load() !== null && configured;
}

export function configure(anonId: string): Promise<boolean> {
  if (configuring) return configuring;
  configuring = (async () => {
    const P = load();
    if (!P) return false;
    const extra = Constants.expoConfig?.extra as any;
    const key = Platform.OS === 'ios'
      ? process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? extra?.rcIosKey
      : process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? extra?.rcAndroidKey;
    if (!key) return false;
    try {
      // appUserID = anon_id: RevenueCat webhook'u backend'e bu kimlikle geliyor
      // (main.rc_webhook, users.anon_id ile eşleştiriyor). Farklı bir kimlik
      // kullanılırsa satın alma hiçbir kullanıcıya bağlanmaz.
      await P.default.configure({ apiKey: key, appUserID: anonId });
      configured = true;
      return true;
    } catch {
      return false;
    }
  })();
  return configuring;
}

export async function getPlans(): Promise<Plan[]> {
  const P = load();
  if (!P || !configured) return [];
  try {
    const offerings = await P.default.getOfferings();
    const pkgs = offerings.current?.availablePackages ?? [];
    return pkgs.map((p) => ({
      identifier: p.identifier,
      priceString: p.product.priceString,
      period: (p.product as any).subscriptionPeriod ?? null,
    }));
  } catch {
    return [];
  }
}

export type PurchaseResult =
  | { ok: true }
  | { ok: false; cancelled: boolean; message: string };

export async function purchase(identifier: string): Promise<PurchaseResult> {
  const P = load();
  if (!P || !configured) {
    return { ok: false, cancelled: false, message: 'Satın alma bu sürümde kullanılamıyor.' };
  }
  try {
    const offerings = await P.default.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p) => p.identifier === identifier,
    );
    if (!pkg) {
      return { ok: false, cancelled: false, message: 'Bu plan şu an sunulmuyor.' };
    }
    await P.default.purchasePackage(pkg);
    return { ok: true };
  } catch (e: any) {
    // Kullanıcı iptali hata değil: hata mesajı göstermek dönüşümü düşürüyor.
    if (e?.userCancelled) {
      return { ok: false, cancelled: true, message: '' };
    }
    return {
      ok: false,
      cancelled: false,
      message: 'Satın alma tamamlanamadı. Tekrar dener misin?',
    };
  }
}

export async function restore(): Promise<boolean> {
  const P = load();
  if (!P || !configured) return false;
  try {
    const info = await P.default.restorePurchases();
    return Object.keys(info.entitlements.active).length > 0;
  } catch {
    return false;
  }
}
