/**
 * Yetenek kontrolü — hangi özellik gerçekten çalışıyor?
 *
 * Bu projede birkaç özellik "yazılmış ama çalışmıyor" durumunda kalabiliyor,
 * çünkü iki ayrı yere bağlılar: Expo yapılandırmasındaki anahtar ve `package.json`
 * içindeki paket. Biri eksikse özellik SESSİZCE kapalı kalıyor — sarmalayıcı
 * kodu hatayı yutuyor ve arayüz butonu hiç göstermiyor. Uygulama çalışıyor
 * görünüyor, sadece o özellik yok.
 *
 * En sinsi hâli anahtarın DOLU, paketin EKSİK olması: yapılandırmaya bakan
 * herkes "reklamlar açık" sanıyor, kullanıcı hiç reklam görmüyor ve jeton
 * kazanamıyor. Bu betik tam olarak o uyumsuzluğu arıyor.
 *
 * `npm run yetenek:check` ile çalışır; bilgi amaçlı çıktı verir, yalnızca
 * TUTARSIZLIKTA hata döner.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const KOK = process.cwd();
const OK = '\x1b[32m✓\x1b[0m';
const KAPALI = '\x1b[33m○\x1b[0m';
const NO = '\x1b[31m✗\x1b[0m';
let hata = 0;

const app = JSON.parse(await readFile(join(KOK, 'app.base.json'), 'utf8')).expo;
const pkg = JSON.parse(await readFile(join(KOK, 'package.json'), 'utf8'));
const rootLayout = await readFile(join(KOK, 'app/_layout.tsx'), 'utf8');
const paywall = await readFile(join(KOK, 'app/onboarding/paywall.tsx'), 'utf8');
const bagimliliklar = { ...pkg.dependencies, ...pkg.devDependencies };
const extra = app.extra ?? {};

const dolu = (k) => extra[k] !== null && extra[k] !== undefined && extra[k] !== '';

const YETENEKLER = [
  {
    ad: 'Abonelik (RevenueCat)',
    paket: 'react-native-purchases',
    anahtarlar: ['rcAndroidKey', 'rcIosKey'],
    kapaliysa: 'abonelik satın alınamaz; paywall kullanıcıyı ücretsiz akışa geçirir',
  },
  {
    ad: 'Ödüllü reklam (AppLovin MAX)',
    paket: 'react-native-applovin-max',
    anahtarlar: ['maxSdkKey', 'maxAndroidRewardedUnit'],
    kapaliysa: 'jeton kapısında "reklam izle" yolu hiç görünmez',
  },
  {
    ad: 'Analitik (PostHog)',
    paket: 'posthog-react-native',
    anahtarlar: ['posthogKey'],
    kapaliysa: 'onboarding hunisi ölçülmez, nerede kaybettiğin görünmez',
  },
];

console.log('\x1b[1mİsteğe bağlı yetenekler\x1b[0m\n');

for (const y of YETENEKLER) {
  const paketVar = !!bagimliliklar[y.paket];
  const anahtarVar = y.anahtarlar.some(dolu);

  if (paketVar && anahtarVar) {
    console.log(`  ${OK} ${y.ad}`);
    continue;
  }

  if (anahtarVar && !paketVar) {
    // Asıl aranan hata: yapılandırma "açık" diyor, paket yok.
    console.error(`  ${NO} ${y.ad}`);
    console.error(`      Anahtar tanımlı ama '${y.paket}' bağımlılıklarda YOK.`);
    console.error(`      Bu hâliyle özellik sessizce kapalı: ${y.kapaliysa}.`);
    console.error(`      Çözüm: npx expo install ${y.paket}`);
    hata++;
    continue;
  }

  const eksik = [];
  if (!paketVar) eksik.push(`paket (${y.paket})`);
  if (!anahtarVar) eksik.push(`anahtar (${y.anahtarlar.join(' / ')})`);
  console.log(`  ${KAPALI} ${y.ad} — kapalı: ${eksik.join(', ')} eksik`);
  console.log(`      Sonuç: ${y.kapaliysa}`);
}

console.log('\n\x1b[1mAbonelik güven kapısı\x1b[0m\n');
const rcKokte = rootLayout.includes('purchases.configure');
const fiyatKapisi =
  paywall.includes("onPress={storeState === 'ready' ? buy : skip}") &&
  paywall.includes("disabled={storeState === 'loading' || (storeState === 'ready' && !plan)}");
console.log(`  ${rcKokte ? OK : NO} RevenueCat uygulama kökünde yapılandırılıyor`);
console.log(`  ${fiyatKapisi ? OK : NO} Gerçek fiyat gelmeden satın alma çalışmıyor`);
if (!rcKokte) hata++;
if (!fiyatKapisi) hata++;

const pushProjectId = extra.eas?.projectId;
if (pushProjectId) {
  console.log(`  ${OK} Push bildirimleri (Expo/EAS)`);
} else {
  console.log(`  ${KAPALI} Push bildirimleri (Expo/EAS) — kapalı: EAS projectId eksik`);
  console.log('      Sonuç: cihaz ExpoPushToken alamaz; push gönderilmez');
}

// API adresi yayına uygun mu — yerel adresle çıkılan build hiçbir şey yapmaz.
console.log('\n\x1b[1mAPI adresi\x1b[0m\n');
const api = extra.apiUrl ?? '';
if (/127\.0\.0\.1|localhost|10\.0\.2\.2/.test(api)) {
  console.error(`  ${NO} Expo yapılandırmasındaki apiUrl yerel adres: ${api}`);
  console.error('      Yayın derlemesi hiçbir sunucuya ulaşamaz.');
  hata++;
} else if (!api.startsWith('https://')) {
  console.error(`  ${NO} apiUrl https değil: ${api}`);
  hata++;
} else {
  console.log(`  ${OK} ${api}`);
}

if (!hata) {
  console.log('\n\x1b[2mAppLovin ve PostHog v1 için bilinçli olarak kapalıdır.\x1b[0m');
}

process.exit(hata ? 1 : 0);
