# Telve Google Play Hızlı Yayın Tasarımı

## Amaç

Telve'nin mevcut Android uygulamasını yeni özellik eklemeden, satın alma ve temel fal akışları gerçek production servisleriyle doğrulanmış biçimde Google Play'e çıkarmak.

## Başarı ölçütü

İlk production sürümü ancak aşağıdaki koşullar birlikte sağlandığında hazır sayılır:

- `main` dalındaki CI ve `npm run release:check` yeşildir.
- Production AAB, Play Console internal testing kanalına kabul edilmiştir.
- Gerçek Android cihazda onboarding, başlangıç jetonu, kahve falı, tarot, rüya, doğum haritası, sonuç ve geçmiş fallar çalışır.
- Production backend üzerinde kuyruklanan bir fal tamamlanır ve mobil uygulamada açılır.
- Google Play lisans test hesabıyla satın alma ve satın almayı geri yükleme çalışır.
- RevenueCat webhook'u backend'deki kullanıcı katmanını ve kotayı doğru günceller.
- Gizlilik politikası, kullanım koşulları ve veri silme bağlantısı halka açık HTTPS adreslerinde açılır.
- Play Data Safety beyanı, yayın anındaki gerçek yapılandırmayla eşleşir.

## İlk sürüm kapsamı

### Zorunlu

- Onboarding ve 18+ yaş kapısı
- Başlangıç jetonu
- Kahve falı, tarot, rüya ve doğum haritası ritüelleri
- Fal sonucu, paylaşım ve geçmiş fallar
- Tahmin doğrulama ve Kader Günlüğü
- Production FastAPI, PostgreSQL/pgvector, Redis, RQ worker ve scheduler
- LLM üretimi ve ücretsiz kullanıcı blok kütüphanesi
- RevenueCat satın alma, geri yükleme ve backend webhook akışı
- Temel Expo push akışı
- Kullanıcı verisi silme
- TR mağaza listesi, yasal sayfalar ve production AAB

### İlk sürüm sonrasına bırakılanlar

- AppLovin ödüllü reklamların açılması
- PostHog hunileri ve gelişmiş ürün analitiği
- 100–200 gerçek fincanla kapsamlı vision kalibrasyonu
- iOS dağıtımı
- PWA pazarlama kanalı
- Yeni ritüeller, yeni özellikler ve görsel yeniden tasarım

Reklam kodu repoda kalır fakat anahtarlar boş tutulur ve arayüz reklam seçeneği göstermez. Play Console'da uygulama, yayın anındaki bu gerçek duruma göre reklamsız beyan edilir.

## Yayın stratejisi

Çalışma dokuz ardışık kapıya bölünür. Her kapı bir sonrakine geçmeden doğrulanır; başarısız kapı varken mağaza yüklemesine devam edilmez.

### 1. Kaynak kodu sabitleme

- GitHub varsayılan dalı `main` yapılır.
- Eski dallar ilk sürüm çıkana kadar silinmez.
- Yayın çalışması `main` tabanlı kısa ömürlü dallarda yürütülür.
- Yeni özellik kabul edilmez; yalnız yayın engelleyici hata, production yapılandırması ve uyum değişikliği yapılır.

Çıkış ölçütü: varsayılan dal `main`, çalışma ağacı temiz, mevcut CI yeşil.

### 2. Mevcut APK ile cihaz keşif testi

Başarılı GitHub Actions çıktısı olan `telve-apk`, en az bir fiziksel Android cihaza kurulur. Onboarding'den geçmiş fallara kadar ana akış çalıştırılır. Kamera izni, fincan çekimi, tema, Skia yüzeyleri, Türkçe karakterler, paylaşım ve ağ hatası davranışı gözlemlenir.

Bu aşamada satın alma veya production backend'in çalışması beklenmez; amaç native arayüz ve paketleme sorunlarını production kurulumundan önce bulmaktır.

Çıkış ölçütü: uygulamayı çökerten, ana akışı kilitleyen veya kullanıcı verisini kaybettiren native hata yoktur.

### 3. Production backend

Tek bir düşük maliyetli sunucuda FastAPI, PostgreSQL/pgvector, Redis, worker ve scheduler çalıştırılır. Sistem süreçleri işletim sistemi servisleriyle yeniden başlatılır. API yalnız HTTPS üzerinden sunulur. Veritabanı şeması kurulur, production sırları ortam değişkenlerinden verilir ve günlük yedek alınır.

LLM anahtarı bağlanır. Blok kütüphanesi önce `--dry-run`, ardından gerçek seed komutuyla doldurulur. Sağlık kontrolü, kuyruk, scheduler kilitleri, fotoğraf temizliği ve kullanıcı silme işi doğrulanır.

Çıkış ölçütü: yeniden başlatma sonrasında servisler kendiliğinden ayağa kalkar; gerçek bir fal kuyruğa girer, tamamlanır ve veritabanına yazılır.

### 4. Mobil-production bağlantısı

Production profilinin `EXPO_PUBLIC_API_URL` değeri canlı HTTPS API'ye yöneltilir. Preview profili staging adresinde kalır. Mobil istemcinin zaman aşımı, çevrimdışı durum ve sunucu hatalarında kullanıcıyı kilitlemediği doğrulanır.

Çıkış ölçütü: production profilli fiziksel cihaz kurulumu canlı backend üzerinde onboarding ve en az bir ritüeli uçtan uca tamamlar.

### 5. Google Play ve RevenueCat

Google Play abonelik ürünleri ile RevenueCat offering/package yapılandırması kurulur. Backend'in tanıdığı entitlement kimlikleri aynen kullanılır:

- `star`: ayda 10 fal
- `fate`: sınırsız fal
- `yearly`: sınırsız fal

RevenueCat Android anahtarı mobil production yapılandırmasına verilir; webhook production backend'e yöneltilir. Lisans test hesabıyla satın alma, uygulamayı yeniden açma, satın almayı geri yükleme, iptal/sona erme ve sunucu kotası sınanır.

Çıkış ölçütü: Play test satın alması RevenueCat'te görünür, webhook backend katmanını doğru günceller ve geri yükleme yeni kurulumda hakkı geri getirir.

### 6. Yasal ve politika kapısı

Yasal sayfalardaki `[[SIRKET_ADI]]`, `[[SIRKET_ADRESI]]`, `[[ILETISIM_EPOSTA]]`, `[[KVKK_EPOSTA]]` ve `[[YURURLUK_TARIHI]]` alanları gerçek bilgilerle doldurulur. Sayfalar `telve.app` üzerinde HTTPS ile yayınlanır. Gizlilik, koşullar ve veri silme URL'leri uygulamadan ve dış tarayıcıdan açılır.

Data Safety ve içerik derecelendirme cevapları `fal-mobile/docs/play-store.md` temel alınarak, yayın anındaki etkin SDK ve anahtarlara göre doldurulur. Uygulama 18+ ve eğlence amaçlı olarak beyan edilir.

Çıkış ölçütü: `npm run release:check` yeşildir ve Play Console'daki beyanlarla çalışan uygulama arasında bilinen fark yoktur.

### 7. Mağaza varlıkları

Mevcut ikonlar production paketinde kontrol edilir. Türkçe mağaza listesi için telefon ekran görüntüleri ana değer önerisini anlatacak sırada hazırlanır: kişisel harita, kahve çekimi, gerçek sembol overlay'i, yorum, Kader Günlüğü ve geçmiş fallar. En az dört, tercihen altı–sekiz telefon görseli kullanılır.

Başlık, kısa açıklama ve uzun açıklama `fal-mobile/docs/play-store.md` içinden alınır; kodda karşılığı olmayan vaat eklenmez.

Çıkış ölçütü: Play Console mağaza girişi zorunlu alan hatası vermeden kaydedilir.

### 8. Production AAB ve internal testing

Paket adı değiştirilmeyecek şekilde sabitlenir, sürüm kodu artırılır ve Play App Signing kullanan production AAB üretilir. AAB önce internal testing kanalına yüklenir. Play tarafından dağıtılan kurulum, yerel APK yerine test edilir; çünkü imza, split APK ve Play Billing yalnız bu yolla gerçeğe yakın doğrulanır.

Pre-launch report'taki crash, ANR ve uyumluluk sonuçları incelenir. Yalnız yayın engelleyici sonuçlar düzeltilir.

Çıkış ölçütü: Play üzerinden kurulan build ana akışı ve test satın almasını tamamlar; kritik pre-launch hatası yoktur.

### 9. Yayın kararı

Son kontrol listesi iki kişi gerektirmez; kanıtlar komut çıktıları, Actions sonuçları, Play test siparişi ve cihaz test kaydıyla tutulur. Aşağıdakilerden biri kırmızıysa yayın yapılmaz:

- CI veya release kontrolü
- Ana ritüel akışlarından biri
- Satın alma veya geri yükleme
- RevenueCat webhook/kota eşleşmesi
- Production backend yeniden başlatma
- Gizlilik veya veri silme bağlantısı
- Kritik crash/ANR

Hepsi yeşilse build uygun Google Play yayın kanalına yükseltilir.

## Sistem sınırları ve veri akışı

Mobil uygulama anonim kullanıcı kimliğiyle HTTPS API'ye istek gönderir. FastAPI işi Redis/RQ kuyruğuna verir; worker guardrail, astroloji/vision ve LLM hattını çalıştırıp sonucu PostgreSQL'e kaydeder. Mobil uygulama sonucu sorgulayarak veya push deeplink'iyle açar. Satın alma Google Play'den RevenueCat'e, oradan webhook ile backend'e ulaşır; yetki ve kota kararı backend'de verilir.

Mobil istemci satın alma sonucunu tek başına yetki kaynağı saymaz. LLM anahtarı, RevenueCat webhook sırrı ve veritabanı bilgileri mobil pakete konmaz.

## Hata davranışı

- API ulaşılamıyorsa kullanıcıya tekrar denenebilir hata gösterilir; jetonun düşüp düşmediği backend gerçeğinden okunur.
- Worker başarısızsa iş hata durumuna geçer; istemci sonsuz bekleme ekranında kalmaz.
- RevenueCat geçici olarak ulaşılamıyorsa mevcut entitlement korunur ve geri yükleme yeniden denenebilir.
- Push başarısızlığı fal üretimini başarısız saymaz; sonuç geçmiş fallardan açılabilir.
- Seed tamamlanmamışsa ücretsiz üretim production'a açılmaz.
- Yasal bağlantı açılamıyorsa paywall ve mağaza yayını engellenir.

## Test yaklaşımı

Otomatik kapılar mevcut test altyapısını kullanır; yeni test çerçevesi veya genel refactor eklenmez.

- Backend: `python -m pytest` (PostgreSQL/pgvector ve Redis ile)
- Mobil: `npm run ci:check`
- Güvenlik: `npm run security:check`
- Expo uyumu: `EXPO_OFFLINE=1 npx expo-doctor`
- Web/yasal içerik: `npm run build:web` ve `npm run release:check`
- Android paketleme: GitHub Actions preview APK ve production AAB build'i
- Manuel cihaz matrisi: ana akış, kamera, paylaşım, ağ kesintisi, satın alma, geri yükleme ve veri silme

## Bilinçli sadeleştirmeler

- İlk sürümde reklam kapalıdır; satın alma ve organik jeton yolları yeterlidir.
- Tek production ortamı ve tek staging ortamı kullanılır; ayrı mikroservisler kurulmaz.
- Vision için geniş veri toplama projesi yayın sonrasıdır; ilk cihaz testinde temel kabul/ret davranışı kontrol edilir.
- Yeni gözlemleme platformu eklenmez; servis günlükleri, GitHub Actions ve Play Console ilk sürüm için yeterlidir.
- Mevcut Expo, FastAPI, RQ ve RevenueCat yapısı korunur; mimari yeniden yazılmaz.

## Yayın sonrası ilk işler

İlk sürüm kararlı olduktan sonra sırasıyla crash/ANR takibi, satın alma dönüşümü, fincan kabul oranı ve D1/D7 retention ölçülür. AppLovin ancak ücretsiz kullanıcıların jeton döngüsünde ölçülmüş bir ihtiyaç oluşursa açılır. Vision kalibrasyonu gerçek kullanıcı fotoğraflarında kabul oranı yüzde 85'in altına düşerse önceliklendirilir.
