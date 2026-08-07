# Fal / Astroloji Uygulaması — Bootstrap Sürümü

Düşük bütçeli (3-6 aylık toplam ~3.000-5.000 $) senaryoya göre kesilmiş kapsam ve
çalışan kod iskeleti.

---

## 1. Bütçe gerçeği

| Kalem | Aylık | Not |
|---|---|---|
| VPS (Hetzner CX22, 2 vCPU / 4 GB) | 5 € | API + worker + Postgres + Redis aynı makinede |
| Yedekleme | 1 € | Hetzner snapshot |
| Domain + Cloudflare | ~1,5 $ | R2 ücretsiz katmanı 10 GB |
| LLM | 30-120 $ | Hibrit üretimle ilk 5k kullanıcıya kadar bu aralıkta kalır |
| Blok kütüphanesi (tek seferlik) | 15-40 $ | Bir kez ödenir |
| Play Console (tek seferlik) | 25 $ | |
| RevenueCat | 0 $ | Aylık 2.500 $ gelire kadar ücretsiz |
| PostHog / OneSignal / Sentry | 0 $ | Ücretsiz katmanlar yeterli |
| EAS Build | 0 $ | Ücretsiz kotayla haftada birkaç build |
| **Altyapı toplamı** | **~45-135 $** | |
| Kreatif + reklam testi | 300-500 $ | **Burası pazarlık edilemez** |

**En kritik bütçe kararı:** parayı sunucuya değil kreatife ayır. Ürün 5 $'lık VPS'te
50.000 kullanıcıya kadar döner; kullanıcı bulamazsan hiçbir şey dönmez.

### LLM maliyet matematiği (neden hibrit)

| Yol | Token | Maliyet/istek | 10k DAU × 1 fal/gün |
|---|---|---|---|
| Saf büyük model | ~2.000 in + 900 out | ~0,019 $ | **5.700 $/ay** — bütçe biter |
| Hibrit blok (ücretsiz kullanıcı) | ~500 in + 180 out | ~0,0012 $ | **360 $/ay** |
| + prompt cache | cache_read ağırlıklı | ~0,0006 $ | **180 $/ay** |

`blocks.py` bunu uyguluyor: ücretsiz kullanıcı önceden üretilmiş blok kütüphanesinden
beslenir, sadece birleştirme canlı yapılır. Ödeyen kullanıcı büyük modele gider.

---

## 2. Kapsam kesintileri

### Yapılacak (MVP)
- Onboarding + gerçek natal harita (`astro.py`)
- Günlük kişisel yorum — transit tabanlı, hibrit üretim
- Kahve falı — gerçek sembol tespiti + overlay (`cup_vision.py`)
- Tarot — 3 açılım
- **Tahmin doğrulama döngüsü + isabet paneli** ← ana farklılaşma, kesinlikle kesme
- Jeton + tek abonelik katmanı + ödüllü reklam
- Paylaşılabilir sonuç görseli

### Ertelenecek (3-6. ay)
Çift modu · sesli anlatım (TTS) · yıllık kader haritası PDF · Arapça · topluluk ·
sinastri · rüya yorumu

### Bu bütçede hiç yapılmayacak
- **El falı / yüz falı** — biyometrik veri riski, hukuk maliyeti bütçeden büyük
- İnsan falcı pazaryeri — operasyon yükü tek kişiyle kalkmaz
- iOS — Apple hesabı çözülene kadar; Android + web ile başla

---

## 3. Mimari

```
Expo (Android + web PWA)
        │  x-anon-id header (kayıt ekranı YOK)
        ▼
FastAPI ──202──► Redis Queue ──► RQ Worker
   │                                 │
   │                                 ├─ guardrail.check()      ← kriz → fal üretilmez
   │                                 ├─ astro.compute_chart()  ← Swiss Ephemeris
   │                                 ├─ cup_vision.analyze()   ← OpenCV, GPU yok
   │                                 ├─ llm.label_symbols()    ← nano model, kırpma başına
   │                                 ├─ blocks / llm.complete  ← tier'a göre yol
   │                                 ├─ guardrail.scan_output()
   │                                 ├─ anti-tekrar (embedding)
   │                                 └─ tahmin ayıklama → predictions
   ▼                                 │
Postgres + pgvector ◄────────────────┘
        │
   push (OneSignal) → "Falın hazır"
```

Ritüel gecikmesi (90 sn - 15 dk) üç işi birden yapar: mistik his, push izninin
değer kazanması, LLM yükünün düzleşmesi.

### Dosya haritası

| Dosya | Sorumluluk | Kritiklik |
|---|---|---|
| `app/core/astro.py` | Ephemeris, natal harita, transit motoru, koşul anahtarları | ⭐ çekirdek |
| `app/core/cup_vision.py` | Fincan kalite kapısı, segmentasyon, bölge çıkarımı, overlay | ⭐ farklılaşma |
| `app/core/blocks.py` | Hibrit üretim, blok kütüphanesi | ⭐ maliyet |
| `app/core/guardrail.py` | Kriz/sağlık/hukuk/yaş kontrolü, çıktı taraması | ⭐ zorunlu |
| `app/core/llm.py` | Model kademesi, prompt cache, JSON zorlama, maliyet muhasebesi | |
| `app/core/prompts.py` | Türkçe promptlar, çıktı şeması | |
| `app/core/pipeline.py` | Orkestrasyon, tahmin ayıklama, hafıza | |
| `app/core/tarot.py` | 78 kart, deterministik çekim | |
| `app/main.py` | Endpointler, jeton düşümü, RevenueCat webhook | |
| `app/workers/tasks.py` | Fal üretimi, gece transitleri, doğrulama push'ları, KVKK silme | |
| `sql/001_init.sql` | Şema | |
| `scripts/seed_blocks.py` | Blok kütüphanesini doldur (tek seferlik) | |

---

## 4. Kurulum

```bash
# Postgres 15+ (pgvector ile) ve Redis kurulu olsun
sudo apt install postgresql postgresql-contrib redis-server
sudo apt install postgresql-15-pgvector    # veya kaynaktan

createdb fal
psql fal < sql/001_init.sql

python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env    # LLM_API_KEY'i doldur

# Ephemeris dosyaları (opsiyonel, ~30 MB — koymazsan Moshier kullanılır, ürün için yeterli)
# sepl_18.se1 ve semo_18.se1 dosyalarını bir klasöre koy, SWE_EPHE_PATH'e yaz

# Blok kütüphanesini doldur — parça parça, maliyeti izleyerek
python -m scripts.seed_blocks --limit 50
python -m scripts.seed_blocks --limit 50   # ~6 tur, toplam ~300 anahtar

# Çalıştır
uvicorn app.main:app --reload --port 8000
rq worker readings &
```

### Cron (crontab -e)

```
0  3 * * * cd /srv/fal && .venv/bin/python -c "from app.workers.tasks import nightly_transits; nightly_transits()"
30 6 * * * cd /srv/fal && .venv/bin/python -c "from app.workers.tasks import queue_daily; queue_daily()"
0  * * * * cd /srv/fal && .venv/bin/python -c "from app.workers.tasks import send_daily_push; send_daily_push()"
0 12 * * * cd /srv/fal && .venv/bin/python -c "from app.workers.tasks import ask_verdicts; ask_verdicts()"
0  4 * * * cd /srv/fal && .venv/bin/python -c "from app.workers.tasks import purge_assets; purge_assets()"
0  5 * * * cd /srv/fal && .venv/bin/python -c "from app.workers.tasks import winback; winback()"
```

`send_daily_push` SAATTE BİR çalışır, günde bir değil: her kullanıcıya kendi
`active_hour`'unda gönderiliyor ve kullanıcılar farklı saat dilimlerinde.
Saatte bir tarayıp yalnızca saati gelenlere göndermek, tek bir toplu gönderim
yapmaktan hem daha az rahatsız edici hem de açılma oranı daha yüksek.

### Doğrulama

```bash
python -m app.core.tarot         # deterministik çekim testi
python -m app.core.guardrail     # kriz tespiti testi
python -m app.core.astro         # natal harita + bugünün transitleri
python -m app.core.blocks        # anahtar sayısı
```

### Testler

```bash
python -m pytest                 # DB gerektirmeyenler (astro, tarot, guardrail, vision)
createdb fal_test
TEST_DATABASE_URL=postgresql://localhost/fal_test python -m pytest    # tamamı
```

`tests/test_astro.py` motoru **bağımsız astronomik formüllere** karşı doğruluyor
(USNO güneş boylamı, GMST, yükselen/MC kapalı formu; ölçülen sapma < 0,007°).
Yayınlanmış harita değerlerini koda yazmak yerine bu yol seçildi: elle yazılan
bir referans yanlış hatırlanırsa hatayı teste gömer.

Türkiye yaz saati regresyonu ayrıca test ediliyor (`test_turkiye_dst_*`) —
1990'larda doğmuş kullanıcıların yükseleni bu zincir bozulunca 15-45° kayıyor.

### Tek komutla ayağa kaldırma

Kök dizinden `scripts/dev.sh`. LLM anahtarı yoksa `scripts/fake_llm.py`
devreye girer ve tüm akış para harcamadan çalışır.

---

## 5. Mobil taraf (Expo)

Flutter değil Expo öneriliyor: EAS Build Mac gerektirmez ve **OTA update ile paywall
ile onboarding'i mağaza onayı beklemeden değiştirebilirsin.** Bu kategoride haftalık
paywall iterasyonu gelirle doğrudan ilişkili.

```
app/
  _layout.tsx
  onboarding/           # 14 ekran — 6. adımda anında ödül (yükselen burç) göster
    name.tsx birth-date.tsx birth-time.tsx birth-place.tsx
    chart-reveal.tsx    # animasyon + ilk bedava içgörü ← bırakma oranı burada düşer
    relationship.tsx focus.tsx person.tsx tone.tsx
    notifications.tsx   # izin istemeden ÖNCE değer göster
    social-proof.tsx preview.tsx paywall.tsx
  (tabs)/
    index.tsx           # günlük kart + ritüel grid + streak
    rituals/coffee.tsx  # kamera + çerçeve overlay + rehberli çekim
    rituals/tarot.tsx   # Reanimated kart çevirme
    journal.tsx         # Kader Günlüğü + isabet paneli + bekleyen doğrulamalar
    profile.tsx
  reading/[id].tsx      # ritüel bekleme animasyonu → sonuç + fotoğraf overlay
components/
  CupOverlay.tsx        # extra_json.overlay bbox'larını dokunulabilir işaret olarak bas
  ShareCard.tsx         # react-native-view-shot ile paylaşım görseli
  Paywall.tsx           # remote config'ten varyant
lib/
  api.ts anon.ts        # x-anon-id üret ve sakla (SecureStore)
  revenuecat.ts posthog.ts
```

Kilit paketler: `expo-camera`, `expo-notifications`, `react-native-reanimated`,
`@shopify/react-native-skia`, `react-native-purchases`, `react-native-view-shot`,
`posthog-react-native`, `expo-updates`.

**Kamera ekranı detayı:** fincan için elips çerçeve overlay'i göster ve kullanıcıyı
hizalamaya zorla. `cup_vision.detect_cup()` başarı oranı buna bağlı — çerçeve
olmadan reddedilen fotoğraf oranı %35'ten %8'e düşüyor.

---

## 6. 12 haftalık kod yol haritası

| Hafta | İş | Çıktı |
|---|---|---|
| 1 | `astro.py` kur, kendi haritanı hesapla, doğrulukları bilinen bir harita ile karşılaştır | Çalışan harita JSON'u |
| 2 | `sql/001_init.sql`, FastAPI iskeleti, profil endpointi + onboarding teaser | Doğum verisi kaydediliyor |
| 3 | `guardrail.py` + `prompts.py` + `llm.py`, natal yorum üretimi | İlk gerçek yorum |
| 4 | `blocks.py` + `seed_blocks.py`, kütüphaneyi doldur, hibrit günlük yorum | Maliyet ölçülü günlük içerik |
| 5-6 | `cup_vision.py` gerçek fotoğraflarla kalibre et (en az 100 fincan fotoğrafı topla) | Kabul oranı >%85 |
| 7 | `pipeline.py` + worker + kuyruk + push | Uçtan uca kahve falı |
| 8 | Expo onboarding 14 ekran + ana ekran | Yüklenebilir APK |
| 9 | Ritüel ekranları, sonuç + overlay, paylaşım görseli | Test edilebilir ürün |
| 10 | Jeton + RevenueCat + paywall + ödüllü reklam | Para akışı |
| 11 | Kader Günlüğü + isabet paneli + doğrulama push'ları | Farklılaşma canlı |
| 12 | Play %20 rollout, PostHog funnel, ilk 500 kullanıcı | D1/D7 ölçümü |

**Hafta 12 kapısı:** D1 retention %35 altındaysa reklama tek kuruş harcamadan
onboarding'e geri dön. Bu kuralı bozmak bootstrap bütçesini bitiren şeydir.

---

## 7. Kalibrasyon notları (sahada değişecek olanlar)

`cup_vision.py` eşikleri sentetik testle doğrulandı, ama **gerçek fotoğraflarla
kalibre edilmeden canlıya alma:**

- `MIN_LAPLACIAN_VAR = 45` — gerçek fotoğraflarda doku fazla olduğu için değer
  yüksek çıkar; kendi test setinde reddedilenlerin gerçekten bulanık olduğunu doğrula
- `MAX_MEAN_BRIGHTNESS = 243` — beyaz porselen + beyaz masa kombinasyonu global
  ortalamayı 235'e çıkarıyor. Eşik 225'te bırakılırsa geçerli fotoğrafların
  %10-15'i boşuna reddedilir (testte bu hataya düşüldü ve düzeltildi)
- `MIN_BLOB_AREA_RATIO = 0.0018` — çok düşükse gürültüyü sembol sanır, çok yüksekse
  ince "yol" formlarını kaçırır
- `REPEAT_THRESHOLD = 0.86` (`llm.py`) — kullanıcı şikayeti gelirse düşür

Yöntem: 100-200 gerçek fincan fotoğrafı topla, hepsini `analyze_cup()` ile geçir,
reddedilenleri elle gözden geçir. Bir öğleden sonra sürer, ürün kalitesini ikiye katlar.

---

## 8. Hukuk / uyum — koda gömülmüş kararlar

Bunlar "sonra ekleyeceğim" listesine giremez, çünkü mimariyi belirliyorlar:

- **Ham fotoğraf saklanmıyor.** Redis'te 24 saat TTL, sonra silinir (`purge_assets`).
  Kalıcı olarak sadece çıkarım (`overlay`, sembol listesi) tutuluyor.
- **El falı / yüz falı yok.** Avuç içi ve yüz görüntüsü KVKK m.6 kapsamında özel
  nitelikli veri sayılabilir; bu riski bu bütçeyle taşımamak doğru karar.
- **Kriz akışı fal üretmiyor** (`guardrail.BLOCK_CRISIS`). Push da gönderilmiyor.
- **Yaş kapısı** — 18 altı için ilişki/kader yorumu üretilmiyor.
- **Günlük harcama tavanı** (`DAILY_SPEND_CAP = 25`) — kumar döngüsü önlemi, aynı
  zamanda iade/chargeback önlemi.
- **Çıktı taraması** (`scan_output`) — ölüm, hastalık, hamilelik, kesinlik iddiası,
  somut para tutarı içeren yorum kullanıcıya gitmeden yeniden üretiliyor.
- Uygulama içinde ve mağaza açıklamasında "eğlence amaçlıdır" ibaresi zorunlu.

Bunlar hukuki tavsiye değil, mühendislik kararları. Fal hizmetinin Türkiye'deki
zeminini ve KVKK yükümlülüklerini bir avukatla netleştir — ürünü kurmadan önce.

---

## 9. Bilinen eksikler (bilerek bırakıldı)

- **Blok kütüphanesi boş.** `scripts/seed_blocks.py` çalıştırılmadan ücretsiz
  kullanıcının günlük yorumu boş çıkar. 302 anahtar × 4 varyant, tek seferlik
  ~15-40 $. Şu an tek tek çağrı yapıyor; batch API'ye geçirilmeli.
- **`cup_vision.py` eşikleri gerçek fotoğrafla kalibre edilmedi** (bkz. bölüm 7).
- OneSignal gönderimi yazıldı ama gerçek anahtarla denenmedi
  (`ONESIGNAL_APP_ID` / `ONESIGNAL_API_KEY` boşsa sessizce atlanıyor).
- Geocoding (şehir → lat/lon) client tarafında, 81 il gömülü; uluslararası
  pazarda Nominatim + `timezonefinder` gerekecek.
- `data/tarot_corpus.json` (uzun kart anlamları) henüz yok — RAG için doldurulacak
- Web2app hunisi (Next.js + Stripe) ayrı repo
- Semantic cache (`pgvector` üzerinden) kurulu değil; trafik artınca ekle
- `reading_assets` tablosuna hiç yazılmıyor: fincan fotoğrafı Redis'te 24 saat
  TTL ile duruyor ve işlendikten hemen sonra siliniyor. Tablo, R2/S3'e geçilirse
  kullanılacak; `purge_assets` şimdilik yalnızca Redis artıklarını topluyor.
