# Telve Google Play yayın kontrol listesi

Bu dosya, yayın kararının kanıt kaydıdır. Her satır için durum, kanıt bağlantısı
ve kontrol tarihi doldurulmadan production'a terfi yapılmaz. Bağlantılarda gizli
anahtar, kişisel kullanıcı kimliği veya tam Play test sipariş numarası tutulmaz.

**Test edilen sürüm:** `________________`  
**Git commit:** `________________`  
**AAB / Play release kimliği:** `________________`

Durum değerleri: `☐ Bekliyor` · `✅ Geçti` · `❌ Bloke`

## Kaynak ve CI

| Kontrol | Beklenen kanıt | Sorumlu | Durum | Kanıt bağlantısı | Kontrol tarihi |
|---|---|---|---|---|---|
| GitHub varsayılan dalı | Repository ayarlarında varsayılan dalın `main` olduğunu gösteren kayıt | Geliştirici | ☐ Bekliyor | — | — |
| Temiz ve sabit kaynak | Test edilen commit SHA'sı ve temiz çalışma ağacı kaydı | Geliştirici | ☐ Bekliyor | — | — |
| Ana CI | Aynı commit için yeşil GitHub Actions çalışması | Geliştirici | ☐ Bekliyor | — | — |
| Mobil release kontrolleri | Production değişkenleriyle başarılı `npm run release:check` çıktısı | Geliştirici | ☐ Bekliyor | — | — |
| Expo Doctor | Aynı kaynakta tüm kontrollerin geçtiği `npx expo-doctor` çıktısı | Geliştirici | ☐ Bekliyor | — | — |
| Backend testleri | PostgreSQL ve Redis ile tüm `pytest` testlerinin geçtiği çıktı | Geliştirici | ☐ Bekliyor | — | — |

## Fiziksel Android cihaz

Her cihaz kanıtında model, Android sürümü, uygulama sürümü/versionCode ve tarih bulunmalı.

| Kontrol | Beklenen kanıt | Sorumlu | Durum | Kanıt bağlantısı | Kontrol tarihi |
|---|---|---|---|---|---|
| Play kurulumu | Sideload yerine internal testing üzerinden başarılı kurulum | Test sahibi | ☐ Bekliyor | — | — |
| Onboarding ve kimlik | Ad, doğum, yer, tercihler, bildirim ve paywall tamamlandı; yeniden açılışta kimlik ve 5 başlangıç jetonu korundu | Test sahibi | ☐ Bekliyor | — | — |
| Kahve falı | Gerçek fotoğrafla queued/running/done, sembol katmanı, sonuç ve geçmiş başarılı | Test sahibi | ☐ Bekliyor | — | — |
| Tarot | Ritüel, sonuç ve geçmiş başarılı | Test sahibi | ☐ Bekliyor | — | — |
| Doğum haritası | Ritüel, sonuç ve geçmiş başarılı | Test sahibi | ☐ Bekliyor | — | — |
| Rüya yorumu | Ritüel, sonuç ve geçmiş başarılı | Test sahibi | ☐ Bekliyor | — | — |
| Destekleyici akışlar | Açık/koyu tema, Türkçe karakterler, paylaşım kartı, bildirim deeplink'i, tahmin kararı ve profil bağlantıları başarılı | Test sahibi | ☐ Bekliyor | — | — |
| Ağ kurtarma | İstek sırasında ağ kesilince zaman aşımı gösterildi; bağlantı sonrası tekrar deneme başarılı | Test sahibi | ☐ Bekliyor | — | — |
| İş sürerken yeniden açma | Uygulama kapatılıp açıldığında çalışan fal sonradan geçmişten erişilebilir | Test sahibi | ☐ Bekliyor | — | — |
| Veri silme | Ayrılmış test kimliği için UI onayı ve backend silme davranışı doğrulandı | Test sahibi | ☐ Bekliyor | — | — |

## Production backend

| Kontrol | Beklenen kanıt | Sorumlu | Durum | Kanıt bağlantısı | Kontrol tarihi |
|---|---|---|---|---|---|
| HTTPS sağlık kontrolü | `https://api.telve.app/health` için HTTPS 200 ve sağlıklı yanıt | Operasyon | ☐ Bekliyor | — | — |
| Yeniden başlatma güvenliği | Reboot sonrası API, worker, scheduler, PostgreSQL, Redis ve Nginx aktif | Operasyon | ☐ Bekliyor | — | — |
| Kuyruk ve gerçek yorum | Production API'de bir test ritüeli `done` oldu ve veritabanına yazıldı | Operasyon | ☐ Bekliyor | — | — |
| Blok kütüphanesi | Dry-run, küçük parti, tam seed ve tekrarlı çalıştırmada çoğaltmama kayıtları | Operasyon | ☐ Bekliyor | — | — |
| Scheduler ve temizlik | Scheduler kilidi, geçici fincan görseli temizliği ve kullanıcı silme işi doğrulandı | Operasyon | ☐ Bekliyor | — | — |
| Günlük yedek | Başarılı, erişimi kısıtlı PostgreSQL dump kaydı | Operasyon | ☐ Bekliyor | — | — |
| Geri yükleme testi | Ayrılmış test veritabanına başarılı restore ve temel tablo sayımları | Operasyon | ☐ Bekliyor | — | — |

## Billing ve RevenueCat

| Kontrol | Beklenen kanıt | Sorumlu | Durum | Kanıt bağlantısı | Kontrol tarihi |
|---|---|---|---|---|---|
| Play ürünleri | Aktif Star aylık, Fate aylık ve Yıllık base planlarının redakte ekran kaydı | Mağaza sahibi | ☐ Bekliyor | — | — |
| Entitlement eşleşmesi | RevenueCat'te exact `star`, `fate`, `yearly` eşleşmeleri ve current offering | Mağaza sahibi | ☐ Bekliyor | — | — |
| Webhook | Redakte başarılı event kaydı ve backend katman güncellemesi | Geliştirici | ☐ Bekliyor | — | — |
| Star satın alma | Play lisans testinde satın alma; `/v1/me` katmanı `star`, kota 10 | Test sahibi | ☐ Bekliyor | — | — |
| Sınırsız plan | Fate veya Yearly test satın alması; doğru entitlement ve sınırsız kota | Test sahibi | ☐ Bekliyor | — | — |
| Geri yükleme | Yeniden kurulumdan sonra satın alma hakkı geri geldi | Test sahibi | ☐ Bekliyor | — | — |
| İptal ve sona erme | İptalde `will_renew=false`, süre sonuna kadar hak, sona erince aktif entitlement yok | Test sahibi | ☐ Bekliyor | — | — |

## Yasal sayfalar

| Kontrol | Beklenen kanıt | Sorumlu | Durum | Kanıt bağlantısı | Kontrol tarihi |
|---|---|---|---|---|---|
| Yasal bilgiler | Beş onaylı değer tutarlı; `npm run yasal:check` başarılı | Uygulama sahibi | ☐ Bekliyor | — | — |
| Gizlilik sayfaları | `/gizlilik.html` ve `/privacy.html` HTTPS 200, doğru başlık ve içerik | Uygulama sahibi | ☐ Bekliyor | — | — |
| Koşullar | `/kosullar.html` HTTPS 200, doğru başlık ve içerik | Uygulama sahibi | ☐ Bekliyor | — | — |
| Veri silme | `/veri-silme.html` HTTPS 200; uygulama içi silme yolu ile tutarlı | Uygulama sahibi | ☐ Bekliyor | — | — |
| Uygulama bağlantıları | Profildeki yasal bağlantıların dış tarayıcıda doğru sayfaları açtığı cihaz kaydı | Test sahibi | ☐ Bekliyor | — | — |

## Mağaza varlıkları

| Kontrol | Beklenen kanıt | Sorumlu | Durum | Kanıt bağlantısı | Kontrol tarihi |
|---|---|---|---|---|---|
| Metinler | `play-store.md` başlık, kısa/tam açıklama, kategori ve 18+ bilgisinin kaydedilmiş Play önizlemesi | Mağaza sahibi | ☐ Bekliyor | — | — |
| Uygulama ikonu | Production ikonunun Play önizlemesi | Mağaza sahibi | ☐ Bekliyor | — | — |
| Feature graphic | Kabul edilen feature graphic'in Play önizlemesi | Mağaza sahibi | ☐ Bekliyor | — | — |
| Telefon görselleri | En az 4 görsel: kişisel harita, fincan çekimi, sembol/sonuç, Kader Günlüğü | Mağaza sahibi | ☐ Bekliyor | — | — |
| İçerik derecelendirmesi | 18+, eğlence amaçlı, dijital satın alma var ve kumar yok cevaplarının kayıt özeti | Mağaza sahibi | ☐ Bekliyor | — | — |

## Data Safety ve uygulama içeriği

| Kontrol | Beklenen kanıt | Sorumlu | Durum | Kanıt bağlantısı | Kontrol tarihi |
|---|---|---|---|---|---|
| SDK durumu | Resolved production config: RevenueCat açık; PostHog ve AppLovin anahtarları boş | Geliştirici | ☐ Bekliyor | — | — |
| Data Safety | RevenueCat/Play satın alma verisi açık, fotoğraf geçici, LLM kullanıcı içeriği paylaşımı ve silme beyanlarının kaydedilmiş özeti | Mağaza sahibi | ☐ Bekliyor | — | — |
| Reklam ve analitik | v1 için reklam yok; AppLovin ve PostHog veri türleri “Hayır” olarak kaydedildi | Mağaza sahibi | ☐ Bekliyor | — | — |
| İzin gerekçeleri | Kamera yalnız kahve ritüeli, bildirim reddedilebilir; gereksiz izin yok | Mağaza sahibi | ☐ Bekliyor | — | — |
| Politika bağlantıları | Gizlilik ve veri silme URL'leri Play Console'da doğru kaydedildi | Mağaza sahibi | ☐ Bekliyor | — | — |

## Production AAB ve Play işlemesi

| Kontrol | Beklenen kanıt | Sorumlu | Durum | Kanıt bağlantısı | Kontrol tarihi |
|---|---|---|---|---|---|
| Release config | `com.telve.app`, production HTTPS API, RevenueCat public Android key ve EAS proje kimliği doğrulandı | Geliştirici | ☐ Bekliyor | — | — |
| Production AAB | Başarılı production EAS build bağlantısı; artifact türü AAB | Geliştirici | ☐ Bekliyor | — | — |
| Internal draft | Aynı AAB'nin Play internal testing kanalında taslak işlenme kaydı | Mağaza sahibi | ☐ Bekliyor | — | — |
| Play işlemesi | İmza, manifest, target SDK, native başlangıç ve billing engeli yok | Mağaza sahibi | ☐ Bekliyor | — | — |

## Pre-launch report

| Kontrol | Beklenen kanıt | Sorumlu | Durum | Kanıt bağlantısı | Kontrol tarihi |
|---|---|---|---|---|---|
| Crash ve ANR | Reproducible crash/ANR bulunmadığını gösteren rapor özeti | Test sahibi | ☐ Bekliyor | — | — |
| Başlangıç ve kritik kontroller | Bozuk başlangıç, erişilemeyen kritik kontrol veya politika ihlali yok | Test sahibi | ☐ Bekliyor | — | — |
| Engelleyici olmayan uyarılar | Cihaz-özel uyarılar post-launch notuna ayrıldı veya “yok” kaydedildi | Test sahibi | ☐ Bekliyor | — | — |

## Promotion kararı

| Kontrol | Beklenen kanıt | Sorumlu | Durum | Kanıt bağlantısı | Kontrol tarihi |
|---|---|---|---|---|---|
| Tüm engelleyici satırlar | Yukarıdaki hiçbir satır `❌ Bloke` veya `☐ Bekliyor` değil | Yayın sahibi | ☐ Bekliyor | — | — |
| Artifact bütünlüğü | Cihazda ve billing testinde kullanılan AAB ile terfi ettirilecek AAB aynı | Yayın sahibi | ☐ Bekliyor | — | — |
| Nihai karar | `TERFİ ET` veya `BLOKE — <tek dar kapsamlı engel>` kararı ve tarihi | Yayın sahibi | ☐ Bekliyor | — | — |

**Karar:** `________________`  
**Karar sahibi:** `________________`  
**Tarih:** `________________`
