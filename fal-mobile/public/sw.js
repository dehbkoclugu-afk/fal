/**
 * Service worker — kurulabilir PWA ve çevrimdışı kabuk.
 *
 * Önbellek stratejisi kasıtlı olarak dar tutuldu:
 *
 *  - Gezinme (navigation) → ÖNCE AĞ. Böylece yeni sürüm yayınlandığında
 *    kullanıcı eski index.html'e kilitlenmiyor. Ağ yoksa önbellekteki kabuk.
 *  - Statik varlıklar (/_expo/, /assets/, ikonlar) → ÖNCE ÖNBELLEK.
 *    Metro çıktısının dosya adları içerik hash'i taşıyor, bu yüzden
 *    süresiz önbelleklemek güvenli.
 *  - Diğer HER ŞEY (API çağrıları, üçüncü taraf) → hiç dokunma.
 *
 * API yanıtları ASLA önbelleklenmiyor. Fal içeriği, jeton bakiyesi ve
 * abonelik durumu kullanıcıya özel ve değişken; eski bir yanıtı göstermek
 * "5 jetonun var" derken 402 almasına yol açar.
 */
const SURUM = 'telve-v1';
const CEVRIMDISI = '/';        // çevrimdışı yedek kabuk
const KABUK = [
  CEVRIMDISI,
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SURUM).then((c) => c.addAll(KABUK)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((adlar) =>
        Promise.all(adlar.filter((a) => a !== SURUM).map((a) => caches.delete(a))),
      )
      .then(() => self.clients.claim()),
  );
});

function statikMi(url) {
  return (
    url.pathname.startsWith('/_expo/') ||
    url.pathname.startsWith('/assets/') ||
    /\.(png|jpg|jpeg|svg|ico|ttf|woff2?)$/.test(url.pathname)
  );
}

self.addEventListener('fetch', (e) => {
  const istek = e.request;
  if (istek.method !== 'GET') return;

  const url = new URL(istek.url);
  if (url.origin !== self.location.origin) return; // API ve üçüncü taraf: dokunma

  if (istek.mode === 'navigate') {
    // Sayfayı KENDİ adresiyle önbelleğe al. Hepsini '/' anahtarına yazmak,
    // statik render'da (her route ayrı HTML) çevrimdışı iken kullanıcıya
    // en son gezdiği sayfayı ana sayfa diye göstermek demekti.
    e.respondWith(
      fetch(istek)
        .then((yanit) => {
          if (yanit.ok) {
            const kopya = yanit.clone();
            caches.open(SURUM).then((c) => c.put(istek, kopya));
          }
          return yanit;
        })
        .catch(() =>
          caches
            .match(istek)
            .then((r) => r || caches.match(CEVRIMDISI))
            .then((r) => r || Response.error()),
        ),
    );
    return;
  }

  if (statikMi(url)) {
    e.respondWith(
      caches.match(istek).then(
        (bulunan) =>
          bulunan ||
          fetch(istek).then((yanit) => {
            if (yanit.ok) {
              const kopya = yanit.clone();
              caches.open(SURUM).then((c) => c.put(istek, kopya));
            }
            return yanit;
          }),
      ),
    );
  }
});
