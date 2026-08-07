/**
 * Ödüllü reklam sarmalayıcı.
 *
 * Jeton ekonomisinin kapanan ayağı: ücretsiz kullanıcı jetonu bitince
 * ödemekten başka yolu olmazsa akış tıkanıyor ve kullanıcı çıkıyor. Ödüllü
 * video bu kategorideki en yüksek eCPM'li ve en az rahatsız edici format;
 * kullanıcı izlemeyi kendisi seçiyor.
 *
 * NEDEN SARMALAYICI: reklam SDK'sı native modül. Expo Go'da ve web'de yok;
 * doğrudan çağrılırsa uygulama çöker ve akışı hiç test edemezsin. Burada
 * SDK yoksa `available()` false döner ve arayüz butonu hiç göstermez.
 *
 * Jetonu SUNUCU veriyor (POST /v1/coins/reward, günde 5 tavan). İstemci
 * "reklam izlendi" deyip jeton basamıyor — aksi halde tavan istemciye
 * bırakılmış olurdu.
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { api } from './api';

// `any`: paket bağımlılıklarda YOK ve olması da gerekmiyor. Reklam SDK'sı
// yalnızca üretim derlemesine eklenecek; tip olarak import etmek, paketi
// kurmayan herkeste tip kontrolünü kırardı.
let mod: any = undefined;
let hazir = false;

function load(): any {
  if (mod !== undefined) return mod;
  try {
    mod = require('react-native-applovin-max');
  } catch {
    mod = null;
  }
  return mod;
}

function unitId(): string | null {
  const extra = Constants.expoConfig?.extra as any;
  return (Platform.OS === 'ios' ? extra?.maxIosRewardedUnit
                                : extra?.maxAndroidRewardedUnit) ?? null;
}

export function available(): boolean {
  return load() !== null && !!unitId();
}

export async function init(): Promise<void> {
  const M = load();
  const extra = Constants.expoConfig?.extra as any;
  if (!M || !extra?.maxSdkKey || hazir) return;
  try {
    await M.initialize(extra.maxSdkKey);
    hazir = true;
  } catch {
    /* SDK başlatılamazsa reklam yolu kapalı kalır, akış etkilenmez */
  }
}

export type RewardResult =
  | { ok: true; coins: number }
  | { ok: false; reason: 'unavailable' | 'not_loaded' | 'dismissed' | 'cap' | 'error' };

/**
 * Ödüllü video gösterir; kullanıcı ödülü hak ederse sunucudan jeton ister.
 */
export async function showRewarded(): Promise<RewardResult> {
  const M = load();
  const unit = unitId();
  if (!M || !unit) return { ok: false, reason: 'unavailable' };

  try {
    await init();
    const yuklu = await M.RewardedAd.isAdReadyAsync(unit);
    if (!yuklu) {
      M.RewardedAd.loadAd(unit);
      return { ok: false, reason: 'not_loaded' };
    }

    const kazandi = await new Promise<boolean>((resolve) => {
      let verildi = false;
      M.RewardedAd.addAdReceivedRewardEventListener(() => {
        verildi = true;
      });
      M.RewardedAd.addAdHiddenEventListener(() => resolve(verildi));
      M.RewardedAd.addAdDisplayFailedEventListener(() => resolve(false));
      M.RewardedAd.showAd(unit);
    });

    if (!kazandi) return { ok: false, reason: 'dismissed' };

    // Jetonu sunucu veriyor; tavan da orada.
    const res = await api.rewardCoins();
    return { ok: true, coins: res.coins };
  } catch (e: any) {
    if (e?.status === 429) return { ok: false, reason: 'cap' };
    return { ok: false, reason: 'error' };
  }
}
