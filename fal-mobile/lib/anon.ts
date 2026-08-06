/**
 * Anonim kimlik.
 *
 * Onboarding'de kayıt ekranı YOK. Cihazda üretilen bir kimlik yeterli.
 * Kayıt zorunluluğu ilk ekran dönüşümünü %30-50 düşürüyor; sosyal giriş
 * değer gösterildikten SONRA, profil ekranından öneriliyor.
 */
import * as SecureStore from 'expo-secure-store';

const KEY = 'anon_id';
let cached: string | null = null;

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function getAnonId(): Promise<string> {
  if (cached) return cached;
  let id = await SecureStore.getItemAsync(KEY);
  if (!id) {
    id = uuid();
    await SecureStore.setItemAsync(KEY, id);
  }
  cached = id;
  return id;
}
