/**
 * Anonim kimlik.
 *
 * Onboarding'de kayıt ekranı YOK. Cihazda üretilen bir kimlik yeterli.
 * Kayıt zorunluluğu ilk ekran dönüşümünü %30-50 düşürüyor; sosyal giriş
 * değer gösterildikten SONRA, profil ekranından öneriliyor.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'anon_id';
let cached: string | null = null;

/**
 * expo-secure-store web'de çalışmıyor (native Keychain/Keystore sarmalayıcısı).
 * Web PWA planlanan Faz 1 kanallarından biri olduğu için orada localStorage'a
 * düşüyoruz: anon_id bir sır değil, sadece cihaz kimliği.
 */
const store = {
  async get(k: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      try {
        return globalThis.localStorage?.getItem(k) ?? null;
      } catch {
        return null;
      }
    }
    return SecureStore.getItemAsync(k);
  },
  async set(k: string, v: string): Promise<void> {
    if (Platform.OS === 'web') {
      try {
        globalThis.localStorage?.setItem(k, v);
      } catch {
        /* özel sekmede yazma engellenebilir; oturum boyunca bellekte kalır */
      }
      return;
    }
    await SecureStore.setItemAsync(k, v);
  },
};

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getAnonId(): Promise<string> {
  if (cached) return cached;
  let id = await store.get(KEY);
  if (!id) {
    id = uuid();
    await store.set(KEY, id);
  }
  cached = id;
  return id;
}

/**
 * KVKK silme sonrası cihaz kimliğini tazeler.
 *
 * Sunucu silinen kaydın anon_id'sini serbest bırakıyor; kimlik burada da
 * yenilenmezse aynı cihaz aynı kimlikle geri gelir ve sunucu ona YENİ ama
 * aynı isimli bir kullanıcı açar. Silme talebinin karşılığı, cihazın da
 * yeni bir kimlikle temiz başlaması.
 */
export async function resetAnonId(): Promise<string> {
  const id = uuid();
  await store.set(KEY, id);
  cached = id;
  return id;
}
