/**
 * i18n katmanı.
 *
 * Tasarım kararları:
 *
 * 1. ÇEVİRİ DEĞİL, NATIVE KATALOG. Her dil kendi dosyasında sıfırdan yazılır.
 *    Türkçeden çevrilen metin o pazarda ürünü "yabancı" hissettiriyor.
 *
 * 2. EKSİK ANAHTAR DERLEME HATASI. Katalog tipi `Katalog = Record<Anahtar,
 *    string>`; yeni bir dil eklerken bir anahtar unutulursa TypeScript
 *    şikayet ediyor. Çalışma anında sessizce Türkçeye düşen yarım bir dil,
 *    kullanıcıya iki dil karışık gösterir.
 *
 * 3. RTL AYRI BİR İŞ. Arapça sağdan sola; sadece metni çevirmek yetmiyor,
 *    düzenin de dönmesi gerekiyor. `uygulaYon()` bunu React Native'in
 *    I18nManager'ına bağlıyor ve NATIVE'DE UYGULAMANIN YENİDEN BAŞLAMASINI
 *    gerektiriyor — bu yüzden dil seçimi açılışta okunuyor.
 *
 * 4. DİL SUNUCUYLA PAYLAŞILIYOR. Guardrail'in kriz kaynakları dile bağlı
 *    (Türkiye'nin 112/183'ünü Arapça konuşan kullanıcıya göstermek gerçek
 *    bir başarısızlık), o yüzden seçilen dil profile yazılıyor.
 */
import { I18nManager, Platform } from 'react-native';
import * as Localization from 'expo-localization';

import { tr, type Anahtar } from './tr';

export type { Anahtar };
export type Katalog = Record<Anahtar, string>;

export type DilTanimi = {
  code: string;
  /** Kendi dilinde adı — dil seçicide böyle görünmeli */
  native: string;
  rtl: boolean;
  katalog: Katalog;
};

/**
 * Kayıtlı diller.
 *
 * Yeni dil eklerken: `lib/i18n/<kod>.ts` yaz, buraya ekle, `npm run
 * i18n:check` çalıştır. Eksik anahtar varsa derleme kırılır.
 *
 * Backend tarafında da karşılığı olmalı (`app/core/locales.py`) — orada
 * kriz desenleri ve acil yardım numaraları tutuluyor ve onlar olmadan bir
 * dil kaydedilemiyor.
 */
export const DILLER: DilTanimi[] = [
  { code: 'tr', native: 'Türkçe', rtl: false, katalog: tr },
];

export const VARSAYILAN = 'tr';

let aktif: DilTanimi = DILLER[0];

function bul(code: string | null | undefined): DilTanimi | undefined {
  if (!code) return undefined;
  const c = code.toLowerCase().replace('_', '-');
  return DILLER.find((d) => d.code === c) ?? DILLER.find((d) => d.code === c.split('-')[0]);
}

/** Cihaz dilinden desteklenen bir dile karar verir. */
export function cihazDili(): DilTanimi {
  for (const d of Localization.getLocales()) {
    const bulunan = bul(d.languageTag) ?? bul(d.languageCode);
    if (bulunan) return bulunan;
  }
  return DILLER[0];
}

export function aktifDil(): DilTanimi {
  return aktif;
}

export function dilSec(code: string | null | undefined): DilTanimi {
  aktif = bul(code) ?? cihazDili();
  return aktif;
}

/**
 * RTL'i uygula.
 *
 * `true` dönerse düzen yönü DEĞİŞTİ ve native'de uygulamanın yeniden
 * başlatılması gerekiyor — I18nManager değişikliği mevcut ağaca uygulanmıyor.
 * Web'de yeniden başlatmaya gerek yok, `dir` özniteliği yeterli.
 */
export function uygulaYon(rtl: boolean): boolean {
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    }
    I18nManager.allowRTL(rtl);
    return false;
  }
  const degisti = I18nManager.isRTL !== rtl;
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
  return degisti;
}

/**
 * Metin getir. `{ad}` yer tutucularını değiştirir.
 *
 * Eksik anahtar tip düzeyinde imkânsız; yine de çalışma anında anahtarın
 * kendisini döndürüyoruz — boş ekran yerine ne eksik olduğu görünsün.
 */
export function t(anahtar: Anahtar, degiskenler?: Record<string, string | number>): string {
  let metin: string = aktif.katalog[anahtar] ?? tr[anahtar] ?? anahtar;
  if (degiskenler) {
    for (const [k, v] of Object.entries(degiskenler)) {
      metin = metin.split(`{${k}}`).join(String(v));
    }
  }
  return metin;
}

/**
 * Sunucu hata kodunu kullanıcıya gösterilecek metne çevirir.
 *
 * Sunucunun `message` alanı Türkçe sabit; onu doğrudan ekrana basmak, dil
 * Arapça'yken Türkçe hata göstermek anlamına geliyordu. Kod sabit bir
 * tanımlayıcı, metin ise dile ait — çeviri bu tarafta yapılıyor.
 *
 * Kataloğda karşılığı olmayan bir kod gelirse (sunucu yeni bir hata
 * eklemiş, uygulama henüz güncellenmemiş) sunucunun metnine düşüyoruz:
 * yanlış dilde bir açıklama, hiç açıklama olmamasından iyi.
 */
export function hataMetni(code: string, sunucuMetni?: string): string {
  const anahtar = `hata.${code}` as Anahtar;
  if (anahtar in aktif.katalog) return t(anahtar);
  return sunucuMetni || t('hata.unknown');
}

/** Sayı biçimlendirme — Arapça-Hint rakamları gibi farklar için. */
export function sayi(n: number): string {
  try {
    return new Intl.NumberFormat(aktif.code).format(n);
  } catch {
    return String(n);
  }
}

/** Tarih biçimlendirme (gün + ay adı). */
export function tarih(iso: string): string {
  try {
    return new Intl.DateTimeFormat(aktif.code, { day: 'numeric', month: 'long' })
      .format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}
