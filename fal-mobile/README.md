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

# API adresi build zamanında gömülüyor (app.json > extra.apiUrl varsayılan).
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000 npx expo start   # Android emülatör
EXPO_PUBLIC_API_URL=http://127.0.0.1:8000 npx expo start --web

npx expo run:android                      # yerel derleme
eas build -p android --profile preview    # paylaşılabilir APK
```

Backend ayrı terminalde: `scripts/dev.sh` (bkz. kök README).

**Sürüm notu:** Sürümler Expo SDK 53 (React 19 / RN 0.79) ile hizalandı ve
`npx expo-doctor` 18/18 geçiyor. Paket eklerken `npx expo install <paket>`
kullan — düz `npm install` SDK matrisini bozuyor. React 18'e düşülürse
expo-router "React.use is not a function" ile beyaz ekrana düşer.

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
| Reklam SDK paketi | `lib/ads.ts` | Kod hazır ve `app.json > extra`'da anahtar yerleri var. `npx expo install react-native-applovin-max` + anahtarlar girilince devreye giriyor; yokken jeton kapısında reklam seçeneği hiç gösterilmiyor |
| Rüya yorumu | ana ekranda "yakında" | Backend tarafı da yok |
| Google ile hesap bağlama | `(tabs)/profile.tsx` | Buton var, akış yok |
| İlçe hassasiyeti | `data/cities.json` | 81 il merkezi var; büyük illerde ilçe farkı yükseleni ~1° kaydırabilir |
| Gizlilik politikası sayfası | `(tabs)/profile.tsx` | `telve.app/gizlilik` henüz yayında değil |

### Anahtar girilecek yerler (`app.json > extra`)

Hepsi `null` iken uygulama çalışıyor; ilgili özellik sessizce kapalı kalıyor.

| Anahtar | Ne açar |
|---|---|
| `eas.projectId` | EAS build ve OTA update (`eas init` dolduruyor) |
| `rcAndroidKey` / `rcIosKey` | RevenueCat — abonelik satın alma |
| `posthogKey` | Onboarding hunisi ve retention ölçümü |
| `maxSdkKey`, `maxAndroidRewardedUnit` | Ödüllü reklam — jeton kazanma yolu |

## 6b. Derleme (EAS)

```bash
npx eas init                 # projectId'yi app.json'a yazar
eas build -p android --profile preview      # paylaşılabilir APK
eas build -p android --profile production   # Play için .aab
```

`eas.json` üç profil taşıyor ve API adresini her profil için ayrı veriyor
(`EXPO_PUBLIC_API_URL`): `development` emülatöre, `preview` staging'e,
`production` canlıya bakıyor. Tek app.json ile üç ortam bu yüzden mümkün.

## 7. Ölçülmesi gereken ilk üç şey

Ürün canlıya çıkınca sırayla bunlar:

1. **Onboarding tamamlama** — `name` → `paywall` arası her adımda düşüş. `reveal`
   ekranından sonraki düşüş %15'i geçiyorsa akış çok uzun.
2. **Fincan kabul oranı** — reddedilen fotoğraf / toplam çekim. %15'in üzerindeyse
   `cup_vision.py` eşikleri veya kamera rehberi sorunlu.
3. **D1 / D7 retention** — D1 %35 altındaysa reklama tek kuruş harcanmaz.
