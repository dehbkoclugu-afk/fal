/**
 * Bildirim yönlendirme kontrolü.
 *
 * Sunucunun gönderdiği her yük tipinin bir hedefi olmalı. Hedefi olmayan
 * bir yük sessizce ana ekrana düşüyor ve bu, bildirime dokunan kullanıcıyı
 * kaybetmek demek — en pahalısı doğrulama bildiriminde, çünkü o kullanıcı
 * tam olarak cevap vermeye geliyor.
 *
 * Sunucudaki gerçek yükler (app/workers/tasks.py):
 *   run_reading      → { reading_id }
 *   ask_verdicts     → { prediction_id, deeplink: 'verdict' }
 *   send_daily_push  → { deeplink: 'daily', transit }
 *   winback          → { deeplink: 'paywall', kampanya, gun }
 *
 * `npm run bildirim:check` ile çalışır.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const KOK = process.cwd();
let hata = 0;
const OK = '\x1b[32m✓\x1b[0m', NO = '\x1b[31m✗\x1b[0m';
const k = (ad, ok, d = '') => {
  console.log(`  ${ok ? OK : NO} ${ad}${d ? '  → ' + d : ''}`);
  if (!ok) hata++;
};

// hedefYol() saf bir fonksiyon; kaynaktan çıkarıp burada çalıştırıyoruz.
// Böylece mobil tarafta test koşucusu kurmadan mantığı doğrulayabiliyoruz.
//
// Gövdeyi süslü parantez sayarak alıyoruz. İlk sürüm "bir sonraki export'a
// kadar" kesiyordu ve araya giren JSDoc yorumu yüzünden kapanış parantezi
// gövdede kalıyordu — kontrol betiği kendi ayrıştırma hatasıyla patlıyordu.
function fonksiyonGovdesi(kaynak, ad) {
  const bas = kaynak.indexOf(`export function ${ad}`);
  if (bas < 0) throw new Error(`${ad} bulunamadı`);
  const acilis = kaynak.indexOf('{', kaynak.indexOf(')', bas));
  let derinlik = 0;
  for (let i = acilis; i < kaynak.length; i++) {
    if (kaynak[i] === '{') derinlik++;
    else if (kaynak[i] === '}' && --derinlik === 0) {
      return kaynak.slice(acilis + 1, i);
    }
  }
  throw new Error(`${ad} kapanmıyor`);
}

const kaynak = await readFile(join(KOK, 'lib/notifications.ts'), 'utf8');
const hedefYol = new Function('yuk', fonksiyonGovdesi(kaynak, 'hedefYol'));

console.log('\x1b[1mSunucunun gönderdiği yükler\x1b[0m');

k('fal hazır → sonuç ekranı',
  hedefYol({ reading_id: 'abc-123' }) === '/reading/abc-123',
  hedefYol({ reading_id: 'abc-123' }));

k('doğrulama → defter, tahmin vurgulu',
  hedefYol({ prediction_id: 'p-1', deeplink: 'verdict' }) === '/(tabs)/journal?vurgu=p-1',
  hedefYol({ prediction_id: 'p-1', deeplink: 'verdict' }));

k('günlük transit → ana ekran',
  hedefYol({ deeplink: 'daily', transit: 'saturn_square_venus' }) === '/(tabs)',
  hedefYol({ deeplink: 'daily', transit: 'x' }));

k('winback → paywall',
  hedefYol({ deeplink: 'paywall', kampanya: 'winback', gun: '14' }) === '/onboarding/paywall',
  hedefYol({ deeplink: 'paywall', kampanya: 'winback' }));

console.log('\n\x1b[1mSınır durumlar\x1b[0m');

k('boş yük → ana ekranda kal', hedefYol(undefined) === null);
k('bilinmeyen yük → ana ekranda kal', hedefYol({ foo: 'bar' }) === null);
k('prediction_id olmadan doğrulama → yine deftere',
  hedefYol({ deeplink: 'verdict' }) === '/(tabs)/journal',
  hedefYol({ deeplink: 'verdict' }));

// Kimlikte URL'yi bozacak karakter olursa yol da bozulur.
const tuhaf = 'a b&c=d';
k('kimlik URL için kaçırılıyor',
  hedefYol({ deeplink: 'verdict', prediction_id: tuhaf })
    === `/(tabs)/journal?vurgu=${encodeURIComponent(tuhaf)}`,
  hedefYol({ deeplink: 'verdict', prediction_id: tuhaf }));

console.log('\n\x1b[1mBağlantı\x1b[0m');

const layout = await readFile(join(KOK, 'app/_layout.tsx'), 'utf8');
k('yönlendirme kök düzende bağlı', layout.includes('useBildirimYonlendirme'));
k('ön plan gösterimi kurulu', layout.includes('bildirimleriKur'));
k('router hazır olmadan çağrılmıyor', /useBildirimYonlendirme\(acilisTamam\)/.test(layout));

const journal = await readFile(join(KOK, 'app/(tabs)/journal.tsx'), 'utf8');
k('defter vurgu parametresini okuyor', journal.includes("useLocalSearchParams"));
k('vurgulanan tahmin başa alınıyor', journal.includes('.sort('));

console.log('\n\x1b[1mTaşıma katmanı\x1b[0m');

const izin = await readFile(join(KOK, 'app/onboarding/notifications.tsx'), 'utf8');
const sunucu = await readFile(join(KOK, '../fal-backend/app/workers/tasks.py'), 'utf8');
const zamanlayici = await readFile(join(KOK, '../fal-backend/app/workers/scheduler.py'), 'utf8');
k('Expo token EAS projectId ile alınıyor',
  izin.includes('getExpoPushTokenAsync({ projectId })') && izin.includes('Constants.easConfig?.projectId'));
k('bildirim vaadi yalnız sunucu kaydından sonra açılıyor',
  izin.indexOf('await api.registerPush') < izin.indexOf('setPushRegistered(true)'));
k('EAS projesi yoksa izin ekranı gösterilmiyor',
  izin.includes('if (!pushAvailable) return null'));
k('Expo token Expo Push Service\'e gönderiliyor',
  sunucu.includes('https://exp.host/--/api/v2/push/send'));
k('başka sağlayıcının token alanına Expo token verilmiyor',
  !sunucu.includes('api.onesignal.com'));
k('teslim receipt\'leri zamanlanmış',
  sunucu.includes('EXPO_RECEIPTS_URL') && zamanlayici.includes('check_push_receipts'));

process.exit(hata ? 1 : 0);
