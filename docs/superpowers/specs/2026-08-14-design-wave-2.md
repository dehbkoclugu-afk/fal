# Telve Dalga 2 — Semantik Art ve Doğum Haritası Tasarımı

**Tarih:** 14 Ağustos 2026  
**Kapsam:** `fal-mobile/docs/DESIGN-ROADMAP-100.md` maddeleri 41–80  
**Hedef:** Telve’nin rastgele/yanlış bağlamlı görsellerini semantik bir art sistemiyle değiştirmek ve doğum haritası deneyimini küçük Android ekrandan yüksek çözünürlüklü paylaşıma kadar tutarlı, erişilebilir ve doğrulanabilir hâle getirmek.

## Karar özeti

Dalga 2 tek çalışma dalında ve tek PR’da tamamlanacaktır. Ancak bitmap art varlıkları ile UI/iş mantığı aynı committe karıştırılmayacaktır:

1. Semantik art registry ve doğrulama sözleşmesi.
2. Art varlıkları ve WebP bütçesi.
3. Doğum haritası reveal ve konu seçimi.
4. Etkileşimli harita çarkı ve erişilebilirlik.
5. Paylaşım çıktısı, snapshot sözleşmeleri ve yayın doğrulaması.

Yeni çalışma zamanı bağımlılığı eklenmeyecek. Mevcut Expo, React Native, yerel görsel varlıkları, `artAssets.ts`, natal bileşenleri ve proje içindeki Node tabanlı CI kontrol deseni genişletilecektir.

## 1. Semantik art modeli

### 1.1 Gruplar ve kimlikler

Art kimlikleri dört açık gruba ayrılır:

- `ritual`: coffee, tarot, dream, natal.
- `topic`: love, money, career, self, general.
- `state`: free, premium, loading, failed.
- `editorial`: daily, history, ledger, share.

Registry her varlık için şu metaveriyi taşır:

- kararlı kimlik;
- grup;
- dark/light kaynak çifti;
- kullanım oranı: `card`, `hero` veya `share`;
- izin verilen yüzeyler;
- metin güvenli alanının yönü.

Ekranlar doğrudan dosya yolu seçmez. Ritüel, konu, durum veya editorial anahtarı registry üzerinden çözümlenir. Bilinmeyen anahtar yalnız kendi grubunun `general`/güvenli fallback’ine gider; natal, tarot veya dream yüzeyleri hiçbir koşulda coffee varlığına düşmez.

### 1.2 Varlık seti

Set en az 24 semantik kimlik içerir:

- coffee: 3;
- tarot: 3;
- dream: 3;
- natal: 3;
- topic: love, money, career, self, general olmak üzere 5;
- editorial: daily, history, ledger, share olmak üzere 4;
- paywall/state: free ve premium olmak üzere 2;
- kalan kimlikler loading, failed ve natal paylaşım yüzeylerini tamamlar.

Her kimliğin dark ve light sürümü bulunur. Böylece en az 48 WebP dosyası sağlanır. Görsel üretim dili Telve’nin mevcut bakır, porselen, gece mavisi ve telve paletini korur. Görsellerde yazı, logo, okunması zorunlu sembol, marka, gerçek kişi veya telifli karakter bulunmaz.

### 1.3 Oran ve boyut sözleşmesi

- `card`: 3:2 yatay master.
- `hero`: 16:9 yatay master.
- `share`: 4:5 dikey master.
- Küçük kart tanınabilirliği 160×100 önizlemede korunur.
- Ana nesne, registry’de tanımlı metin güvenli alanının karşı tarafında yer alır.
- WebP dosya boyutu kart/hero için en fazla 300 KB, share için en fazla 500 KB olur.
- Kaynak çözünürlükleri ilgili yüzeyde bulanıklık üretmeyecek, fakat gereksiz 4K varlık taşımayacak şekilde sabitlenir.

CI; eksik dark/light çifti, registry dışı dosya, bulunmayan dosya, yanlış en-boy oranı ve bütçeyi aşan varlıkta başarısız olur.

## 2. Doğum haritası reveal deneyimi

Reveal yüzeyi kahve fotoğrafı kullanmaz. Yükselen, Güneş ve Ay ayrı bilgi kartlarıdır. Her kart:

- astrolojik semantik mini art;
- burç glifi;
- derece;
- kısa, tek paragraf anlam;
- veri güven etiketi

gösterir.

Doğum saati bilinmiyorsa Yükselen kartı açıkça “tahmin” olarak işaretlenir; kesin sonuç gibi sunulmaz. Loading çarkı ile gerçek sonuç çarkı aynı renk, çizgi ve disk ailesini kullanır. “Haritan çiziliyor” metni merkez diskte, hareketli katmanlardan bağımsız ve okunabilir kalır.

## 3. Konu seçimi ve ödeme bağlamı

Natal konu seçimi love, money, career, self ve general artlarını kullanır. Seçili konu:

- daha aydınlık art perdesi;
- belirgin sınır/şekil;
- erişilebilir seçili durumu

ile gösterilir; seçim yalnız renkle anlatılmaz.

CTA üstünde mevcut bakiye, yorum fiyatı ve abonelik hakkı aynı bilgi bloğunda görünür. Mevcut sunucu fiyatı tek doğruluk kaynağıdır; istemci yeni sabit fiyat üretmez. Yetersiz bakiye mevcut CoinGate/paywall akışına gider.

## 4. Etkileşimli doğum haritası çarkı

Çark dört ayrı görsel katman taşır:

1. Burç halkası.
2. Ev halkası.
3. Gezegen glifleri.
4. Açı çizgileri.

Katmanlar mevcut hesaplanmış natal veriyi tüketir; yeni astroloji hesabı istemciye taşınmaz.

### 4.1 Glif yerleşimi

Yakın gezegenler için deterministik çakışma çözümü kullanılır. Aynı açısal bölgede bulunan glifler, gerçek derecelerini veri olarak korurken görsel olarak sınırlı radyal şeritlere ayrılır. Yerleşim her render’da aynı sonucu verir.

### 4.2 Açı yoğunluğu

- Uyumlu açılar mevcut semantik yeşil/mavi ailesinde;
- sert açılar bakır/kızıl ailesinde;
- seçim dışı çizgiler düşük opaklıkta

gösterilir.

Dar ekranda en anlamlı açılar önceliklendirilir ve çizgi sayısı azaltılır. Veri kaybolmaz; ayrıntı paneli bütün açı listesini sunabilir. Seçilen gezegen hem çarkta hem ayrıntı panelinde aynı anda vurgulanır.

### 4.3 Etkileşim ve erişilebilirlik

- Gezegen dokunma hedefleri en az 44×44 dp olur.
- Gezegen chipleri responsive grid kullanır.
- TalkBack etiketi gezegen adı, burç, derece ve seçili durumunu içerir.
- Büyük sistem yazısında kartlar metni kesmez.
- Teknik ephemeris etiketi ana yüzeyden kaldırılıp yardım içeriğine taşınır.
- Reduce Motion açıkken loading animasyonu sade ve sürekli dönüş içermeyen moda geçer.

## 5. Paylaşım çıktısı

Natal paylaşımı ekran görüntüsünü büyütmez. Aynı doğrulanmış natal veriyle ayrı 4:5 yüksek çözünürlüklü render üretir. Paylaşım çıktısı:

- seçilen gezegen veya genel harita odağı;
- çark;
- temel üçlü;
- Telve görsel kimliği;
- kullanıcıya ait hassas doğum saati/konumunu varsayılan olarak göstermeyen güvenli özet

içerir.

Paylaşım başarısız olursa mevcut ekranda veri kaybı olmaz ve kullanıcı yeniden deneyebilir.

## 6. Veri akışı ve hata davranışı

1. Backend mevcut natal hesaplamasını ve yorum verisini döndürür.
2. İstemci sonuç verisini mevcut tipler üzerinden normalize eder.
3. Reveal kartları ve çark aynı normalize edilmiş modeli tüketir.
4. Art çözümleyici yüzey/grup anahtarını registry varlığına dönüştürür.
5. Eksik veya bilinmeyen veri güvenli semantik fallback ve görünür açıklama üretir.
6. Paylaşım renderer’ı aynı modelin salt okunur kopyasını kullanır.

Geçersiz derece, eksik ev veya tanınmayan gezegen uygulamayı çökertmez. İlgili katman atlanır, diğer sonuçlar gösterilir ve hata telemetriye bağlamsız kişisel veri eklenmeden kaydedilir.

## 7. Test ve kabul ölçütleri

### Statik/CI kontrolleri

- En az 24 registry kimliği ve her biri için dark/light çifti.
- Dosya varlığı, oran ve boyut bütçesi.
- Coffee artının tarot, dream ve natal izinli yüzeylerinde bulunmaması.
- Registry’de tanımlı her yüzeyin çözümlenmesi.
- Mevcut typecheck, i18n, security ve web export kontrollerinin korunması.

### Durum ve snapshot matrisi

- Doğum saati var / yok.
- Küçük Android / büyük Android / tablet.
- Normal yazı / büyük sistem yazısı.
- Dark / light tema.
- Seçimsiz / gezegen seçili.
- Normal motion / Reduce Motion.
- Loading / hazır / eksik veri / paylaşım hatası.

### Davranış kabulü

- Yükselen bilinmiyorsa tahmin etiketi görünür.
- Aynı veri aynı glif yerleşimini üretir.
- Dokunma hedefleri en az 44×44 dp’dir.
- Seçim yalnız renkle anlatılmaz.
- Dar ekranda başlık veya kart metni taşmaz.
- 160×100 önizlemede semantik art konusu ayırt edilir.
- Yüksek çözünürlüklü paylaşım kişisel doğum saatini ve konumu varsayılan olarak göstermez.
- Android Preview APK ve ana CI başarılı tamamlanır.

## 8. Kapsam dışı

- Backend astroloji hesap motorunu değiştirmek.
- Yeni abonelik/jeton ekonomisi tasarlamak.
- iOS’a özel mağaza veya layout çalışması.
- Uzak CDN art servisi kurmak.
- Çalışma zamanı için yeni görsel, chart veya state bağımlılığı eklemek.
- Dalga 3’ün ana ekran ve sistem geneli maddelerini bu PR’a taşımak; yalnız Dalga 2’nin doğrudan gerektirdiği erişilebilirlik davranışları uygulanır.

## 9. Tamamlanma tanımı

Maddeler 41–80 kod, varlık ve doğrulama düzeyinde karşılanmış; bitmap ve UI checkpointleri ayrı commitlerde tutulmuş; bütün kontroller geçmiş; Android Preview APK üretilmiş ve tek PR incelemeye hazır olduğunda Dalga 2 tamamlanmış sayılır.
