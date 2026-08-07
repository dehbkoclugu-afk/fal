/**
 * Web'de AppLovin native modülü yoktur. Bu dosyanın varlığı Metro'nun
 * `react-native-applovin-max` paketini web bundle'ına hiç sokmamasını sağlar;
 * yalnızca `try/catch(require(...))` kullanmak yeterli değil çünkü Metro
 * bağımlılık grafiğini çalışma zamanından önce statik olarak çıkarır.
 */

export function available(): boolean {
  return false;
}

export async function init(): Promise<void> {
  // Web reklamı bu MVP'nin kapsamında değil.
}

export type RewardResult =
  | { ok: true; coins: number }
  | { ok: false; reason: 'unavailable' | 'not_loaded' | 'dismissed' | 'cap' | 'error' };

export async function showRewarded(): Promise<RewardResult> {
  return { ok: false, reason: 'unavailable' };
}
