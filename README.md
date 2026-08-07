# fal — kahve falı + gerçek astroloji

Bootstrap bütçesine (3-6 ay, ~3.000-5.000 $) göre kesilmiş kapsam. Android + web
ile başlar; iOS, Apple hesabı çözülünce eklenir.

```
fal-backend/   FastAPI + RQ worker + Postgres/pgvector — ephemeris, vision, LLM hattı
fal-mobile/    Expo (React Native) — onboarding, ritüeller, Kader Günlüğü
```

Her iki klasörün kendi README'si var; kurulum, mimari kararları ve bilinen
eksikler orada.

---

## Ürün tezi — üç farklılaşma

Apple Guideline 4.3(b) Haziran 2026'da yeniden yazıldı: doygun kategorilerde
"anlamlı biçimde farklı veya geliştirilmiş" olmayan başvurular reddediliyor.
Aşağıdaki üçü pazarlama süsü değil, mağazaya giriş koşulu.

1. **Doğrulanabilir fal** — her yorum yapılandırılmış tahmin nesneleri üretir
   (`konu, iddia, pencere, güven`), penceresi dolunca kullanıcıya "tuttu mu?"
   sorulur, kişisel isabet paneli tutulur. Rakiplerin hiçbirinde yok.
   → `predictions` tablosu, `pipeline.py`, `(tabs)/journal.tsx`
2. **Gerçekten hesaplanmış** — astroloji LLM'e uydurtulmuyor; Swiss Ephemeris
   gerçek gezegen pozisyonlarını, evleri ve açıları hesaplar, LLM sadece yorumlar.
   Kahve falı fotoğrafı süs değil: sembol tespiti yapılır ve fotoğraf üzerinde
   işaretlenir. → `astro.py`, `cup_vision.py`, `CupOverlay.tsx`
3. **Hafızası olan** — kullanıcının anlattığı kişiler ve olaylar uzun süreli
   hafızaya yazılır, sonraki yorumlarda referans verilir. → `memories` tablosu

## Çalıştır

```bash
scripts/dev.sh          # Postgres + Redis + API + worker
```

LLM anahtarı gerekmiyor: `LLM_API_KEY` tanımlı değilse `scripts/fake_llm.py`
devreye giriyor ve tüm akış (fal üretimi, kuyruk, vision etiketleme, tahmin
ayıklama) para harcamadan uçtan uca çalışıyor. Gerçek modele geçmek için
`LLM_API_KEY=... scripts/dev.sh`.

Mobil:

```bash
cd fal-mobile && npm install
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000 npx expo start   # Android emülatör
npm run build:web                                          # kurulabilir PWA
```

Testler:

```bash
cd fal-backend
python -m pytest                                    # DB'siz çalışanlar
TEST_DATABASE_URL=postgresql://localhost/fal_test python -m pytest   # tamamı
```

## Durum

| Parça | Durum |
|---|---|
| Ephemeris / natal harita / transit motoru | ✓ bağımsız astronomik formüllerle doğrulandı (sapma < 0,007°), TR yaz saati regresyonu dahil |
| Kahve falı vision hattı | ✓ uçtan uca; eşikler **gerçek fotoğrafla kalibre edilmedi** |
| Tarot (78 kart, deterministik + karta özel korpus) | ✓ |
| Guardrail (kriz / yaş / sağlık) | ✓ yaş kapısı profildeki doğum verisinden |
| Hibrit blok üretimi (maliyet) | ✓ kütüphane **doldurulmadı** (`seed_blocks.py`, tek seferlik 15-40 $) |
| Tahmin doğrulama + isabet paneli + takip yorumu | ✓ uçtan uca |
| Transit bildirimleri (gece tarama → kişisel push) | ✓ zincir bağlı, **OneSignal anahtarıyla denenmedi** |
| Seri (streak), winback, KVKK kalıcı silme | ✓ |
| Jeton + 3 abonelik katmanı (kotalı) + ödüllü reklam yolu | ✓ backend tam; reklam SDK paketi eklenecek |
| Mobil: onboarding → harita → ritüeller → defter | ✓ tarayıcıda gerçek backend'e karşı çalıştırıldı |
| Web PWA (kurulabilir, çevrimdışı kabuk) | ✓ tarayıcıda doğrulandı — Apple beklerken ikinci kanal |
| RevenueCat / paylaşım kartı / kamera | ✓ yazıldı, **cihazda denenmedi** |

Test: **212 test** (`fal-backend/tests`) + üç uçtan uca senaryo (ana akış,
zincirler, hata yolları).

### Sırada ne var

1. **Gerçek cihazda çalıştır.** Tarayıcı doğrulaması native'i garanti etmez —
   kamera, Skia, RevenueCat, reklam ve push yalnızca cihazda denenebilir.
   `cd fal-mobile && npx eas init && eas build -p android --profile preview`
2. **`python -m scripts.seed_blocks`** — kütüphane boşken ücretsiz kullanıcı
   günlük yorum alamaz. Önce `--dry-run` ile maliyeti gör.
3. **`cup_vision.py` eşiklerini kalibre et** — 100-200 gerçek fincan fotoğrafı.
   Ayrıntı: `fal-backend/README.md` bölüm 7.
4. **Kendi doğum haritanı doğrula:** `python -m app.core.astro`. Yükselen bilinen
   bir kaynaktan 30° kayıyorsa timezone zinciri bozuktur.
5. **Anahtarları gir** (`fal-mobile/app.json > extra` ve `fal-backend/.env`):
   RevenueCat, PostHog, OneSignal, AppLovin. Hepsi boşken uygulama çalışıyor,
   ilgili özellik sessizce kapalı kalıyor.

### Hâlâ yok

Rüya yorumu · sesli anlatım · çift modu · sinastri · Arapça · insan falcı
pazaryeri · web2app hunisi (Stripe) · web push · semantic cache · el falı ve yüz falı (biyometrik
veri riski nedeniyle bilerek dışarıda).

## Uyarı

Fal hizmetinin Türkiye'deki hukuki zeminini ve KVKK yükümlülüklerini bir avukatla
netleştir. Kodda gömülü uyum kararları `fal-backend/README.md` bölüm 8'de.
