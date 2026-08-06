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
npx expo install --fix        # sürümleri SDK ile hizala (aşağıdaki nota bak)
cp ../fal-backend/.env.example .env   # apiUrl'i app.json > extra içinde ayarla

npx expo start                # Expo Go ile hızlı deneme
npx expo run:android          # yerel derleme
eas build -p android --profile preview   # paylaşılabilir APK
```

**Sürüm notu:** `package.json` içindeki sürümler kalıptır. İlk iş `npx expo install
--fix` çalıştır; Expo SDK sürümüne göre React Native, Reanimated ve Skia sürümleri
birbirine bağlı ve elle yazılan sürümler çakışır.

**Font notu:** Türkçe diakritiklerini (ğ ş ı İ ç ö ü) bir ekranda gözle doğrula.
Newsreader ve Karla latin-ext taşıyor, ama Google Fonts paketleri bazen subset
geliyor. Sorun çıkarsa display yüzü olarak Literata, gövde için Figtree yedek.

---

## 5. Bilinen eksikler

| Eksik | Nerede | Not |
|---|---|---|
| `useDraft` kalıcı değil | `lib/store.ts` | SecureStore/MMKV'ye bağla, yoksa uygulama kapanınca onboarding sıfırlanır |
| Gerçek transit tarihi | `onboarding/notifications.tsx` | `/v1/me/next-transit` ucu backend'de yazılacak |
| RevenueCat çağrısı | `onboarding/paywall.tsx` | `Purchases.purchasePackage` TODO |
| Fincan fotoğrafı URL'i | `reading/[id].tsx` | Backend `extra_json.photo_uri` döndürmüyor; imzalı kısa ömürlü URL ekle |
| Şehir listesi | `onboarding/place.tsx` | 15 il gömülü, 81 ile çıkar (`data/cities.json`) |
| Paylaşım kartı | — | `react-native-view-shot` ile `ShareCard.tsx` yazılacak; viral döngünün ana parçası |
| Ödüllü reklam | — | AppLovin MAX veya AdMob; jeton kazanma yolu |
| Doğum haritası ritüeli | `ritual/natal.tsx` | Ana ekranda linkli, dosya yok |
| PostHog olayları | — | Paywall funnel'ı ölçülmeden fiyat testi yapılamaz |

## 6. Ölçülmesi gereken ilk üç şey

Ürün canlıya çıkınca sırayla bunlar:

1. **Onboarding tamamlama** — `name` → `paywall` arası her adımda düşüş. `reveal`
   ekranından sonraki düşüş %15'i geçiyorsa akış çok uzun.
2. **Fincan kabul oranı** — reddedilen fotoğraf / toplam çekim. %15'in üzerindeyse
   `cup_vision.py` eşikleri veya kamera rehberi sorunlu.
3. **D1 / D7 retention** — D1 %35 altındaysa reklama tek kuruş harcanmaz.
