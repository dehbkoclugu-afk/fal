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
| Kahve falı vision hattı | ✓ uçtan uca çalışıyor; eşikler **gerçek fotoğrafla kalibre edilmedi** |
| Tarot (78 kart, deterministik) | ✓ |
| Guardrail (kriz / yaş / sağlık) | ✓ |
| Hibrit blok üretimi (maliyet) | ✓ yol çalışıyor; kütüphane **doldurulmadı** (`scripts/seed_blocks.py`) |
| Tahmin doğrulama + isabet paneli | ✓ uçtan uca |
| Mobil: onboarding → harita → ritüeller → defter | ✓ tarayıcıda gerçek backend'e karşı çalıştırıldı |
| Paylaşım kartı / RevenueCat / KVKK silme | ✓ yazıldı, **cihazda denenmedi** |
| Ödüllü reklam (AppLovin/AdMob) | ✗ yok |
| Push gönderimi (OneSignal) | ✓ kod var, **anahtarla denenmedi** |

Test: 156 test geçiyor (`fal-backend/tests`).

### Sırada ne var

1. **Gerçek cihazda çalıştır.** Tarayıcı doğrulaması native'i garanti etmez —
   kamera, Skia, RevenueCat ve push yalnızca cihazda denenebilir.
2. **`scripts/seed_blocks.py`'yi çalıştır** (~302 anahtar, tek seferlik 15-40 $).
   Kütüphane boşken ücretsiz kullanıcı günlük yorumu alamaz.
3. **`cup_vision.py` eşiklerini kalibre et** — 100-200 gerçek fincan fotoğrafı.
   Ayrıntı: `fal-backend/README.md` bölüm 7.
4. **Kendi doğum haritanı doğrula:** `python -m app.core.astro`. Yükselen bilinen
   bir kaynaktan 30° kayıyorsa timezone zinciri bozuktur.

## Uyarı

Fal hizmetinin Türkiye'deki hukuki zeminini ve KVKK yükümlülüklerini bir avukatla
netleştir. Kodda gömülü uyum kararları `fal-backend/README.md` bölüm 8'de.
