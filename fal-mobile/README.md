# Telve — Mobil (Expo / React Native)

Backend `../fal-backend` ile çalışır. Android + web hedefli; iOS, Apple hesabı
çözülünce eklenecek.

---

## 1. Neden Expo, Flutter değil

- **EAS Build Mac istemiyor** — mevcut kısıtla doğrudan uyumlu
- **OTA update (expo-updates)** — paywall ve onboarding'i mağaza onayı beklemeden
  değiştirebiliyorsun. Bu kategoride haftalık paywall iterasyonu gelirle doğrudan
  ilişkili; kod deploy'u gerektiren A/B test pratikte ölü A/B testtir
- Skia + Reanimated ile ritüel animasyonları yeterince iyi

---

## 2. Tasarım yönü

**Reddedilen varsayılan:** bu kategorinin tamamı lacivert gece göğü + altın yıldız
+ parlayan serif kullanıyor (Faladdin, Nebula, Astroline). O paletle çıkmak görsel
olarak taklit sayılmak demek.

**Seçilen yön:** kahve falının gerçek malzeme dünyası. Telve (siyah değil, sıcak
koyu kahve), bakır cezve, porselen fincanın çini mavisi kenarı. Gece göğü değil,
falın gerçekten bakıldığı **masa**.

### Palet — `lib/theme.ts`

| Token | Hex | Rol |
|---|---|---|
| `telve` | `#16100E` | zemin — sıcak, siyaha çalan telve |
| `cezve` | `#241A16` | yükseltilmiş kart |
| `cezveUst` | `#30231D` | basılı / seçili |
| `cizgi` | `#3C2C24` | hairline |
| `bakir` | `#C87942` | birincil aksan — CTA, streak, aktif |
| `cini` | `#3A6EA5` | ikincil — **sadece** veri ve "tuttu" bağlamında |
| `kiremit` | `#B04A34` | "tutmadı", hata |
| `porselen` | `#EFE7DA` | birincil metin |
| `kul` / `kulKoyu` | `#9A897D` / `#6B5C52` | ikincil / üçüncül metin |

### İki kayıt — ürünün imzası

Uygulama iki farklı sesle konuşuyor ve tipografi bunu taşıyor:

| | Ritüel kaydı | Defter kaydı |
|---|---|---|
| Yüz | Newsreader **italic** | JetBrains Mono |
| Nerede | Fal metni, bekleme, onboarding | Kader Günlüğü, isabet paneli, tahmin satırı |
| Karakter | Sıcak, yavaş, imgesel | Tabular, hairline, süssüz |
| Neden | Kehanet mistik olmalı | Hesabı klinik olmalı |

Bu ayrım "doğrulanabilir fal" tezinin görsel karşılığı. Rakiplerin hiçbiri
tahminlerinin hesabını tutmadığı için böyle bir ikinci kayda ihtiyaç duymuyor —
bu yüzden görsel dil de taklit edilemez.

Gövde yüzü: **Karla** (Türkçe diakritikleri sağlam, hafif kendine has grotesk).

### İmza öğesi — `components/TelveRing.tsx`

Tek geometri, iki kayıt:
- `mode="ritual"` → fincan dairesi telveyle dolar, Skia `Turbulence` ile tanecikli
  doku, nefes alma efekti. Bekleme ekranının tamamı bu.
- `mode="ledger"` → isabet oranı kadranı. Çini mavi, doku yok, sabit.

Tüm cesaret bu öğede harcanıyor; etrafındaki her şey kasıtlı olarak sessiz.

---

## 3. Ekran akışı

```
index.tsx (kapı)
 └─ onboarding/
     name → birth → place → reveal ★ → about-you → tone → notifications ★ → paywall
 └─ (tabs)/
     index (bugün)   journal (defter)   profile
 └─ ritual/coffee ★  ritual/tarot
 └─ reading/[id] ★
```

★ = dönüşüm veya farklılaşma açısından kritik ekranlar:

**`onboarding/reveal.tsx`** — Kullanıcı hiçbir şey ödemeden kendisi hakkında doğru
bir şey görüyor (yükselen / güneş / ay, üçü sırayla açılıyor). Üçünü aynı anda
göstermek "hazır şablon" hissi verir; sırayla açılması "az önce hesaplandı" hissi
verir. Bu ekran olmadan sonraki adımlarda bırakma iki katına çıkıyor.

**`onboarding/notifications.tsx`** — İzin istemeden **önce** gerçek bir transit
tarihi gösteriliyor. "Bildirimlere izin ver" → opt-in ~%40; "şu tarihte haritanda
şu hareket var, haber verelim mi" → ~%70. Sistem dialogu tek şans, boşa harcanmıyor.

**`ritual/coffee.tsx`** — Elips çerçeve rehberi + sap işaretçisi. Bu overlay
dekorasyon değil, `cup_vision.detect_cup()`'ın çalışma koşulu: rehber olmadan
fotoğrafların üçte birinde fincan bulunamıyor, rehberle red oranı ~%8'e düşüyor.
Sap 12 yönüne hizalanmazsa konum semantiği (sap = sen, karşısı = başkaları) bozulur.

**`reading/[id].tsx`** — Üç ayrı durum: bekleme ritüeli (sayaç değil, dolan halka),
**kriz akışı** (`guardrail.BLOCK_CRISIS` → fal gösterilmez, destek yönlendirmesi),
sonuç (fincan overlay + serif yorum + deftere yazılan tahminler).

**`(tabs)/journal.tsx`** — Ana farklılaşma. Kasıtlı olarak mistik değil. Tutmayan
tahminler gizlenmiyor, aynı listede duruyor — oranı şişirmek kısa vadede iyi
görünür, güveni öldürür.

---

## 4. Kurulum

```bash
npm install

# API adresi build zamanında gömülüyor (app.config.ts > extra.apiUrl varsayılan).
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000 npx expo start   # Android emülatör
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 npx expo start --web

npx expo run:android                      # yerel derleme
eas build -p android --profile preview    # paylaşılabilir APK
```

Backend ayrı terminalde: `scripts/dev.sh` (bkz. kök README).

**Sürüm notu:** Sürümler Expo SDK 57 (React 19.2 / RN 0.86) ile hizalandı ve
`expo-doctor` 20/20 geçiyor. Paket eklerken Expo'nun SDK matrisindeki native
paket sürümlerini koru; `npm run security:check` üretim bağımlılıklarını ayrıca
tarıyor.

**Font notu:** Türkçe diakritikleri (ğ ş ı İ ç ö ü) tarayıcıda doğrulandı,
Newsreader ve JetBrains Mono'da sorunsuz. Cihazda bir kez daha gözle bak.

---

## 5. Platform ayrımları

| Konu | Karar |
|---|---|
| `TelveRing` | Native'de Skia (telve dokusu), web'de `TelveRing.web.tsx` → react-native-svg. Skia web'de CanvasKit WASM olmadan çalışmıyor; PWA'ya 6 MB indirtmek yerine aynı geometri SVG ile çiziliyor. |
| `anon_id` | Native'de SecureStore, web'de localStorage (SecureStore web'de yok). |
| Fincan fotoğrafı | Cihazda kalıyor. Sunucu ham görüntüyü işledikten hemen sonra siliyor; overlay yerel dosyadan çiziliyor (`lib/store.ts → cupPhotos`). İmzalı URL'e gerek yok, KVKK riski de düşüyor. |
| Büyük harf | `textTransform` KULLANILMIYOR. Türkçe'de "Hilal"→"HILAL" oluyor (doğrusu "HİLAL"). `components/Eyebrow.tsx` `tr` yerel ayarıyla büyütüyor. |

## 6. Bilinen eksikler

| Eksik | Nerede | Not |
|---|---|---|
| Gerçek cihazda çalıştırma | — | Tarayıcıda doğrulandı; kamera, Skia, RevenueCat, reklam ve push yalnızca cihazda denenebilir |
| Reklam servisi | `lib/ads.ts` | Kod ve SDK hazır; `app.config.ts > extra` anahtarları girilince devreye giriyor, anahtar yokken seçenek gösterilmiyor |
| İlçe hassasiyeti | `data/cities.json` | 81 il merkezi var; büyük illerde ilçe farkı yükseleni ~1° kaydırabilir |
| Yasal sayfaların alan adına yayını | `public/` | Dosyalar hazır; gerçek `telve.app` yayını ve sahip bilgileri dış ortam gerektiriyor |

### Anahtar girilecek yerler (`app.config.ts > extra` / build ortamı)

Hepsi `null` iken uygulama çalışıyor; ilgili özellik sessizce kapalı kalıyor.

| Anahtar | Ne açar |
|---|---|
| `eas.projectId` | EAS build, OTA update ve ExpoPushToken (`eas init` dolduruyor) |
| `rcAndroidKey` / `rcIosKey` | RevenueCat — abonelik satın alma |
| `posthogKey` | Onboarding hunisi ve retention ölçümü |
| `maxSdkKey`, `maxAndroidRewardedUnit` | Ödüllü reklam — jeton kazanma yolu |

## 6a. Web (PWA)

```bash
npm run build:web          # dist-web/ — statik, kurulabilir PWA
npm run build:web:local    # yerel API'ye bakan build (tarayıcıda test için)
```

**`EXPO_PUBLIC_*` değiştiyse `--clear` şart.** Bu değerler derleme anında
koda gömülüyor ve Metro'nun önbellek anahtarı ortam değişkenlerini
içermiyor: dosya değişmediyse eski değerle gömülmüş modül aynen yeniden
kullanılıyor. Sonuç, sessizce yanlış API adresine bakan bir build — hata
vermiyor, sadece istekler başka yere gidiyor. `build:web:local` bu yüzden
`--clear` taşıyor.

Kurulabilirlik kriterleri tarayıcıda doğrulandı: manifest, 192/512 + maskable
ikonlar, theme-color, apple-touch-icon, service worker, çevrimdışı kabuk,
derin bağlantı (`/onboarding/name` doğrudan açılıyor).

**`web.output` "static"**: her route ayrı HTML üretiyor. Sebep tek değil —
(1) `app/+html.tsx` yalnızca statik render'da kullanılıyor, PWA etiketleri
oradan geliyor; (2) derin bağlantılar sunucu yapılandırması gerektirmeden
çalışıyor; (3) SEO için zemin hazır oluyor.

**Yayınlarken:** `dist-web/` herhangi bir statik hosta (Cloudflare Pages,
Netlify, Vercel) konur. Host'un uzantısız yolları `.html` dosyasına eşlemesi
gerekiyor — üçü de varsayılan olarak yapıyor.

**`npm run build:web` kullan, düz `expo export` değil.** Statik render boş
bir `<title>` basıyor ve HTML'de ilk title geçerli olduğu için sekme ve
paylaşılan link önizlemesi boş görünüyor; `scripts/postexport.mjs` bunu
temizliyor.

Kamera web'de çalışıyor (getUserMedia), yani kahve falı ritüeli PWA'da da
tam. Bildirimler çalışmıyor — web push ayrı bir iş.

## 6b. Derleme (EAS)

```bash
npx eas init                 # EAS projectId'yi üretir; EAS_PROJECT_ID ortamına ekle
eas build -p android --profile preview      # paylaşılabilir APK
eas build -p android --profile production   # Play için .aab
```

`eas.json` üç profil taşıyor ve API adresini her profil için ayrı veriyor
(`EXPO_PUBLIC_API_URL`): `development` emülatöre, `preview` staging'e,
`production` canlıya bakıyor. Tek dinamik Expo yapılandırmasıyla üç ortam bu yüzden mümkün.

## 7. Ölçülmesi gereken ilk üç şey

Ürün canlıya çıkınca sırayla bunlar:

1. **Onboarding tamamlama** — `name` → `paywall` arası her adımda düşüş. `reveal`
   ekranından sonraki düşüş %15'i geçiyorsa akış çok uzun.
2. **Fincan kabul oranı** — reddedilen fotoğraf / toplam çekim. %15'in üzerindeyse
   `cup_vision.py` eşikleri veya kamera rehberi sorunlu.
3. **D1 / D7 retention** — D1 %35 altındaysa reklama tek kuruş harcanmaz.
