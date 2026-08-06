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

## Durum

| Parça | Durum |
|---|---|
| Ephemeris / natal harita / transit motoru | yazıldı, **gerçek harita ile doğrulanmadı** |
| Kahve falı vision hattı | yazıldı, sentetik testte geçti, gerçek fotoğrafla kalibre edilmedi |
| Tarot (78 kart, deterministik) | ✓ test edildi |
| Guardrail (kriz/yaş/sağlık) | ✓ test edildi |
| Hibrit blok üretimi (maliyet) | yazıldı, kütüphane boş — `seed_blocks.py` çalıştırılacak |
| Mobil: onboarding + ritüel + defter | yazıldı, cihazda çalıştırılmadı |
| Paylaşım kartı, ödüllü reklam, RevenueCat çağrısı | eksik |

**İlk iş:** `cd fal-backend && python -m app.core.astro` — kendi doğum haritanı
hesapla ve bilinen bir kaynakla karşılaştır. Yükselen 30° kayıyorsa timezone
zinciri bozuktur (1990'lar Türkiye DST'si buranın klasik tuzağı). Bu doğrulanmadan
üstüne bir şey inşa etme.

## Uyarı

Fal hizmetinin Türkiye'deki hukuki zeminini ve KVKK yükümlülüklerini bir avukatla
netleştir. Kodda gömülü uyum kararları `fal-backend/README.md` bölüm 8'de.
