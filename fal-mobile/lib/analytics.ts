/**
 * Analitik (PostHog).
 *
 * Neden gerekli: bu kategoride para onboarding'de kazanılıyor ve hangi
 * adımda kaybettiğini bilmeden düzeltemezsin. "D1 %35 altındaysa reklama
 * tek kuruş harcama" kuralının ölçülebilmesi buna bağlı.
 *
 * Sarmalayıcı: anahtar yoksa (yerel geliştirme, Expo Go) her çağrı sessizce
 * düşüyor. Analitik hiçbir koşulda kullanıcı akışını durdurmamalı.
 *
 * KİŞİSEL VERİ GÖNDERİLMEZ. Doğum tarihi, doğum yeri, isim, soru metni ve
 * fal içeriği buraya ASLA girmez — bunlar KVKK kapsamında kişisel veri ve
 * bir analitik sağlayıcıya aktarılmaları ayrı bir hukuki yük getirir.
 * Sadece olay adı ve sayısal/kategorik özellikler gider.
 */
import Constants from 'expo-constants';

type Props = Record<string, string | number | boolean | null | undefined>;

let ph: any = null;
let denendi = false;

function client(): any {
  if (denendi) return ph;
  denendi = true;
  const extra = Constants.expoConfig?.extra as any;
  if (!extra?.posthogKey) return null;
  try {
    const { PostHog } = require('posthog-react-native');
    ph = new PostHog(extra.posthogKey, {
      host: extra.posthogHost ?? 'https://eu.i.posthog.com',
    });
  } catch {
    ph = null;
  }
  return ph;
}

/** Cihaz kimliğini analitik kimliğiyle eşle (anon_id ile aynı). */
export function identify(anonId: string): void {
  client()?.identify?.(anonId);
}

export function track(event: string, props?: Props): void {
  client()?.capture?.(event, props);
}

export function screen(name: string, props?: Props): void {
  client()?.screen?.(name, props);
}

/**
 * Onboarding hunisi. Adım adım ölçülmezse nerede kaybettiğin görünmüyor;
 * README'nin "reveal ekranından sonraki düşüş %15'i geçiyorsa akış çok uzun"
 * kuralı tam olarak bu olaylara bakıyor.
 */
export const ONBOARDING_ADIMLARI = [
  'name', 'birth', 'place', 'reveal', 'about-you', 'tone',
  'notifications', 'paywall',
] as const;

export function onboardingAdim(adim: (typeof ONBOARDING_ADIMLARI)[number]): void {
  track('onboarding_step', {
    step: adim,
    index: ONBOARDING_ADIMLARI.indexOf(adim),
  });
}
