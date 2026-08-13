# Telve Yayın Engelleri Tasarımı

## Amaç

Kahve falı, abonelik, sonuç, bildirim ve Android güvenli alan akışlarındaki ilk beş yayın engelini; mevcut bakır/telve görsel dilini ve ürün mimarisini değiştirmeden kapatmak.

## Seçilen yaklaşım

Üç seçenek değerlendirildi:

1. Yalnız istemci korumaları: küçük diff üretir fakat fincan olmayan görsel, boş backend çıktısı ve ücretlendirme yarışlarını güvenilir biçimde engellemez.
2. İstemci ve sunucu sınırlarını birlikte sertleştirmek: dosya taşımasını React Native uyumlu yapar, ücret düşmeden önce fotoğrafı doğrular ve tamamlanmış sonucu sunucu sınırında garanti eder.
3. Akışları yeni bir durum makinesi ve yeni servislerle yeniden kurmak: daha geniş kapsama sahiptir fakat bu yayın düzeltmesi için gereksiz risk ve bağımlılık ekler.

İkinci yaklaşım seçildi. Yeni bağımlılık veya genel yeniden mimari yoktur.

## Kahve fotoğrafı

- İstemci, yerel URI nesnesini `FormData` içine zorla eklemek yerine dosyayı `fetch(uri).blob()` ile gerçek bir `Blob` olarak ekler.
- Ağ/taşıma hataları sabit, yerelleştirilmiş kullanıcı metnine dönüşür; geliştirici hata mesajı gösterilmez.
- Backend `analyze_cup` ile görüntüyü jeton düşmeden ve okuma kaydı oluşturmadan doğrular.
- Geçersiz görüntü 422 ve sabit `invalid_cup_photo` kodu döndürür. Ayrıntılı çekim yönlendirmesi sunucu mesajında tutulur; istemci bunu yalnız bu güvenli kod için gösterebilir.
- Geçerli ön analiz Redis'e ve worker girdisine aktarılır; worker aynı görüntüyü ikinci kez analiz etmez.
- Hata sonrası ana CTA “Tekrar dene” olur, yeniden çekme seçeneği korunur ve fotoğraf değiştirilmedikçe hata temizlenir.

## Abonelik

- RevenueCat uygulama açılışında anonim kullanıcı kimliğiyle bir kez yapılandırılır.
- `configure` anahtar/modül yoksa veya yapılandırma başarısızsa `false` döndürür.
- Planlar yüklenene ve en az bir gerçek mağaza paketi bulunana kadar satın alma CTA'sı kapalıdır; `—` fiyatlı sahte planlar seçilebilir ürün olarak gösterilmez.
- Kullanıcıya mağaza bağlantısının hazır olmadığı açıkça söylenir; ücretsiz devam her zaman çalışır.
- Kapsam ürün tanımlayıcısından “yıllık = sınırsız” diye türetilmez. Sınırsız kapsam yalnız tanımlayıcı açıkça `fate` veya `unlimited` içeriyorsa gösterilir.

## Sonuç bütünlüğü

- Backend normalizasyonu görünür içerik üretmeyen çıktıyı tamamlanmış saymaz.
- `özet` boşsa ilk dolu bölüm metni veya tavsiye ile doldurulur; hiçbir görünür metin yoksa `empty_output` ile üretim yeniden denenir/başarısız olur.
- `paylasim_cumlesi` boşsa dolu özetten üretilir.
- İstemci yine de savunmacı davranır: paylaşım kartı yalnız kırpılmış, dolu bir satır varsa render edilir.
- Tahminler süreye göre artan sırada gösterilir.

## Bildirim doğruluğu ve bekleme durumu

- Başarılı push token kaydı yerel kalıcı durumda saklanır; izin istemek tek başına bildirim etkin sayılmaz.
- Bekleme ekranı yalnız kayıtlı push varsa “uygulamayı kapatabilirsin” der. Aksi halde ekranda bekleme veya geçmişten tekrar kontrol etme yönlendirmesi gösterir.
- Bekleme ekranı `progress`, dört aşamalı sıra ve yaklaşık kalan süreyi gösterir; sahte kesinlik üretmez.
- EAS projectId yoksa onboarding bildirim ekranı sistem izni istemez ve bildirim vaat etmeden sonraki adıma geçirir.

## Safe area ve erişilebilirlik

- Onboarding progress çubuğu üst inset'i sahiplenir; onboarding içindeki `Screen` bileşenleri üst inset'i ikinci kez eklemez.
- `Screen` isteğe bağlı kenar kontrolü alır; alt inset bütün scroll ve sabit ekranlarda korunur.
- Kahve önizlemesi alt inset dahil padding alır ve küçük ekranlarda ScrollView kullanır.
- Paywall plan seçimi `accessibilityState.selected` ve görünür radyo göstergesi taşır; kapalı CTA `disabled` durumunu bildirir.

## Doğrulama

- Backend: fincan ön doğrulaması, ücret sırası ve çıktı normalizasyonu için birim/API testleri.
- Mobil: TypeScript, mevcut `ci:check`, bildirim/yetenek kontrol scriptleri ve web export.
- PostgreSQL entegrasyon testleri yalnız `TEST_DATABASE_URL` sağlandığında çalışır; yoksa mevcut davranışla skip edilir.

