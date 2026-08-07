/**
 * Web belgesi kabuğu (yalnızca web hedefinde kullanılır).
 *
 * Expo'nun ürettiği varsayılan index.html'de manifest, theme-color ve service
 * worker kaydı yok — yani uygulama tarayıcıda çalışıyor ama KURULAMIYOR.
 * Web PWA planlanan Faz 1 kanallarından biri (Apple hesabı beklerken tek
 * dağıtım yolu), o yüzden kurulabilirlik kriterleri burada tamamlanıyor.
 *
 * Bu dosya native derlemeye girmiyor.
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="tr">
      <head>
        <meta charSet="utf-8" />
        {/* Başlık burada. Statik render helmet ile BOŞ bir <title> de basıyor;
            HTML'de ilk <title> geçerli olduğu için bu kazanıyor. Başlıksız
            bırakmak sekmeyi ve paylaşılan link önizlemesini boş gösteriyordu. */}
        <title>Telve — kahve falı ve doğum haritası</title>
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover: çentikli telefonlarda standalone modda kenarlar */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />

        <meta name="theme-color" content="#16100E" />
        <meta name="color-scheme" content="dark" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="icon" href="/icon-192.png" />

        {/* iOS Safari standalone modu — Android'in manifest karşılığı yok */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Telve" />

        <meta
          name="description"
          content="Fincanındaki gerçek şekilleri okuyan, doğum haritanı gerçek gökyüzünden hesaplayan ve söylediklerinin hesabını tutan fal uygulaması."
        />

        {/* Paylaşıldığında görünen kart — organik trafiğin ilk izlenimi */}
        <meta property="og:title" content="Telve — kahve falı ve doğum haritası" />
        <meta
          property="og:description"
          content="Fincanına gerçekten bakan, tahminlerinin hesabını tutan fal uygulaması."
        />
        <meta property="og:image" content="/icon-512.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />

        {/* ScrollView'ların body kaydırmasını bozmaması için Expo'nun reset'i */}
        <ScrollViewStyleReset />

        {/* Gövde arkaplanı: standalone modda lastik-bant bölgesi de koyu kalsın,
            yoksa aşağı çekildiğinde beyaz bir şerit görünüyor. */}
        <style dangerouslySetInnerHTML={{ __html: ARKAPLAN }} />

        <script dangerouslySetInnerHTML={{ __html: SW_KAYIT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const ARKAPLAN = `
html, body { background-color: #16100E; }
body { overscroll-behavior-y: none; }

/* Tarayıcının varsayılan odak halkası beyaz bir dikdörtgen çiziyor ve
   girdi alanlarının alt-çizgi tasarımını bozuyor. Kaldırmıyoruz —
   klavyeyle gezinen kullanıcı odağı görmek zorunda — paletin bakır
   rengine çeviriyoruz. */
input:focus, textarea:focus, select:focus { outline: none; }
input:focus-visible, textarea:focus-visible, select:focus-visible {
  outline: 2px solid #C87942;
  outline-offset: 2px;
  border-radius: 2px;
}

/* Metin seçimi de varsayılan mavi yerine palet içinde kalsın. */
::selection { background: #C8794255; color: #EFE7DA; }
`;

// Service worker'ı yalnızca üretimde ve güvenli bağlamda kaydet.
// Geliştirmede kaydetmek, Metro'nun sıcak yenilemesini eski önbellekle
// çakıştırıp "değişikliğim neden gelmiyor" saatleri üretiyor.
const SW_KAYIT = `
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;
