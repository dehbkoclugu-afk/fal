# Telve Release Blockers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** İlk beş yayın engelini kök nedenleriyle kapatıp kahve, ödeme, sonuç, bildirim ve Android safe-area akışlarını yayın güvenli hâle getirmek.

**Architecture:** Mevcut Expo/React Native ve FastAPI sınırları korunur. Güvenilir doğrulama ücret düşmeden backend'de yapılır; istemci gerçek mağaza/push durumunu kullanıcıya doğru yansıtır ve ortak `Screen` bileşeni güvenli alan sahipliğini açıklaştırır.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, React Query, RevenueCat, FastAPI, OpenCV, pytest, TypeScript.

## Global Constraints

- Yeni bağımlılık ekleme.
- Ham geliştirici hatalarını kullanıcıya gösterme.
- Fiyat mağazadan gelmeden satın alma başlatma.
- Jeton düşmeden önce kahve fotoğrafını doğrula.
- Boş görünür içeriği `done` olarak kaydetme.
- Push token backend'e başarıyla kaydolmadan bildirim garantisi verme.
- Bakır/telve görsel dilini ve mevcut route yapısını koru.

---

### Task 1: Kahve yükleme ve ön doğrulama

**Files:**
- Modify: `fal-mobile/lib/api.ts`
- Modify: `fal-mobile/app/ritual/coffee.tsx`
- Modify: `fal-mobile/lib/i18n/tr.ts`
- Modify: `fal-backend/app/main.py`
- Modify: `fal-backend/app/core/pipeline.py`
- Modify: `fal-backend/tests/test_api.py`
- Modify: `fal-backend/tests/test_pipeline.py`

**Interfaces:**
- Produces: `api.coffee(photoUri, question, handleAngle)` gerçek `Blob` multipart yüklemesi.
- Produces: coffee endpoint, doğrulanmış `cup_analysis` verisini worker girdisine ekler.

- [x] Geçersiz fincanın `_charge` öncesi 422 döndüğünü doğrulayan API testini yaz.
- [x] Testi çalıştır ve mevcut sırada başarısız olduğunu doğrula.
- [x] URI'yi Blob'a çevir; backend'de `analyze_cup` çağrısını ücretin önüne al.
- [x] Worker/pipeline'ın ön analiz verisini yeniden kullandığını uygula.
- [x] Kullanıcı dostu hata ve tekrar dene durumunu uygula.
- [x] İlgili mobil ve backend testlerini çalıştır.

### Task 2: RevenueCat hazır olma kapısı

**Files:**
- Modify: `fal-mobile/lib/purchases.ts`
- Modify: `fal-mobile/app/_layout.tsx`
- Modify: `fal-mobile/app/onboarding/paywall.tsx`
- Modify: `fal-mobile/lib/i18n/tr.ts`
- Modify: `fal-mobile/scripts/yetenek-check.mjs`

**Interfaces:**
- Produces: `configure(anonId): Promise<boolean>`.
- Consumes: yalnız yapılandırılmış SDK'dan gelen gerçek `Plan[]`.

- [x] RevenueCat anahtarı yokken CTA'nın kapanmasını statik kontrolle sabitle.
- [x] Root layout'ta anonim kimlikle tek seferlik yapılandırmayı ekle.
- [x] Paywall'a loading/unavailable/ready durumlarını ekle.
- [x] Sahte fiyat kartlarını ve yıllık=sınırsız varsayımını kaldır.
- [x] TypeScript ve yetenek kontrolünü çalıştır.

### Task 3: Sonuç bütünlüğü

**Files:**
- Modify: `fal-backend/app/core/pipeline.py`
- Modify: `fal-backend/tests/test_pipeline.py`
- Modify: `fal-mobile/app/reading/[id].tsx`
- Modify: `fal-mobile/components/ShareCard.tsx`

**Interfaces:**
- Produces: `_normalize_output(data) -> dict`, dolu `ozet` ve `paylasim_cumlesi` garantisi.

- [x] Boş ve kısmi LLM çıktıları için normalizasyon testleri yaz.
- [x] Boş görünür çıktıyı `ReadingRejected('empty_output', ...)` ile reddet.
- [x] Paylaşım kartını dolu metin koşuluna bağla.
- [x] Tahminleri `pencere_gun` artan sıraya koy.
- [x] Backend testleri ve TypeScript kontrolünü çalıştır.

### Task 4: Push doğruluğu ve bekleme durumu

**Files:**
- Modify: `fal-mobile/lib/store.ts`
- Modify: `fal-mobile/app/onboarding/notifications.tsx`
- Modify: `fal-mobile/app/reading/[id].tsx`
- Modify: `fal-mobile/lib/i18n/tr.ts`
- Modify: `fal-mobile/scripts/bildirim-check.mjs`

**Interfaces:**
- Produces: kalıcı `pushRegistered: boolean` ve `setPushRegistered`.

- [x] Token backend'e kaydolduğunda flag'i true yapan akışı uygula.
- [x] EAS projectId yokken izin istemeden doğru fallback metnini göster.
- [x] Bekleme ekranı metnini flag'e ve ETA/progress'e bağla.
- [x] Bildirim statik kontrolünü yeni güven koşuluyla güncelle.
- [x] Mobil CI kontrolünü çalıştır.

### Task 5: Safe area ve küçük ekranlar

**Files:**
- Modify: `fal-mobile/components/Screen.tsx`
- Modify: `fal-mobile/app/onboarding/_layout.tsx`
- Modify: `fal-mobile/app/ritual/coffee.tsx`
- Modify: `fal-mobile/app/onboarding/paywall.tsx`

**Interfaces:**
- Produces: `Screen` için `safeTop?: boolean`, `safeBottom?: boolean` props.

- [x] Onboarding layout ile Screen arasındaki çift üst inset'i kaldır.
- [x] Kahve önizlemesini scroll ve alt inset ile koru.
- [x] Paywall seçeneklerine seçili durum göstergesi ve erişilebilirlik durumu ekle.
- [x] TypeScript, CI ve web export çalıştır.

### Task 6: Son doğrulama

**Files:**
- Verify only.

- [x] `npm run ci:check` çalıştır.
- [x] `npm run release:check` çalıştır.
- [x] `PYTHONPATH=. python -m pytest -q` çalıştır.
- [x] `git diff --check` ve `git status --short` çalıştır.
- [x] Değişiklik kapsamını ve kalan yapılandırma gereksinimlerini raporla.

