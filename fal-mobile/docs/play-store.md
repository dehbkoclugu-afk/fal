# Google Play yayın dosyası

Bu dosya, Play Console'da doldurulacak formların **tek doğru kaynağı**.
Buradaki cevaplar koda bakılarak yazıldı; tahmin yok. Kod değişirse burası da
değişmeli — özellikle Veri Güvenliği (Data Safety) formu.

> **Neden bu kadar önemli:** Veri Güvenliği formundaki bir yanlış beyan,
> uygulamanın mağazadan kaldırılma sebebi. "Fotoğraf topluyor musun?" sorusuna
> yanlış cevap vermek, gizlilik politikasının yanlış olmasından daha ağır
> sonuç doğuruyor.

---

## 0. Yayından önce yapılacaklar

| # | İş | Durum |
|---|----|-------|
| 1 | Yasal sayfalardaki yer tutucuları doldur (`npm run yasal:check` yeşile dönene kadar) | ⬜ |
| 2 | Yasal sayfaları `telve.app` alan adında yayınla, tarayıcıda aç ve doğrula | ⬜ |
| 3 | Bir avukata gizlilik politikası ve kullanım koşullarını inceletin | ⬜ |
| 4 | Production ortamında RevenueCat Android anahtarını doldur; PostHog ve MAX anahtarlarını boş bırak | ⬜ |
| 5 | `npm run yetenek:check` — hangi özelliğin kapalı olduğunu gör, bilerek karar ver | ⬜ |
| 6 | EAS projesini bağla; production profili `autoIncrement` ile sürümü yönetsin | ⬜ |
| 7 | EAS/FCM v1 push kimlik bilgilerini oluştur ve gerçek cihazda test et | ⬜ |
| 8 | `npm run release:check` | ⬜ |

**`yetenek:check` neyi yakalıyor:** bu projede birkaç özellik iki yere birden
bağlı — `app.json`'daki anahtar ve `package.json`'daki paket. Biri eksikse
özellik sessizce kapalı kalıyor; sarmalayıcı hatayı yutuyor ve arayüz butonu
hiç göstermiyor. En sinsi hâli anahtarın dolu, paketin eksik olması:
yapılandırmaya bakan herkes "açık" sanıyor, kullanıcı özelliği hiç görmüyor.

Doldurulacak yer tutucular:

| Yer tutucu | Ne yazılacak |
|---|---|
| `[[SIRKET_ADI]]` | Veri sorumlusunun tam yasal unvanı (şahıs şirketiyse ad soyad) |
| `[[SIRKET_ADRESI]]` | Tebligata elverişli açık adres |
| `[[ILETISIM_EPOSTA]]` | Genel destek adresi |
| `[[KVKK_EPOSTA]]` | KVKK başvurularının gideceği adres (aynısı olabilir) |
| `[[YURURLUK_TARIHI]]` | Yayına çıkış tarihi, `GG.AA.YYYY` |

---

## 1. Veri Güvenliği (Data Safety) formu

### Genel

| Soru | Cevap | Gerekçe |
|---|---|---|
| Veriler aktarım sırasında şifreleniyor mu? | **Evet** | Tüm istekler HTTPS |
| Kullanıcı verisinin silinmesini talep edebiliyor mu? | **Evet** | Uygulama içi `DELETE /v1/me` + web sayfası |
| Veriler üçüncü taraflarla paylaşılıyor mu? | **Evet** | Aşağıdaki tabloya bak |
| Uygulama Play'in Aile Politikası kapsamında mı? | **Hayır** | 18+ hedefleniyor |

### Toplanan veri türleri

Play'in kendi kategori adlarıyla. **Toplanan** = sunucumuza gidiyor,
**Paylaşılan** = üçüncü tarafa aktarılıyor.

| Play kategorisi | Toplanıyor | Paylaşılıyor | Zorunlu mu | Amaç |
|---|---|---|---|---|
| Ad (Name) | Evet | Evet¹ | Zorunlu | Uygulama işlevi, kişiselleştirme |
| E-posta | **Hayır** | Hayır | — | Toplanmıyor |
| Kullanıcı kimlikleri (User IDs) | Evet | Evet² | Zorunlu | Uygulama işlevi, abonelik doğrulama |
| Fotoğraflar | **Evet** | **Evet¹** | İsteğe bağlı³ | Uygulama işlevi |
| Diğer kullanıcı içeriği (soru ve rüya metni) | Evet | Evet¹ | İsteğe bağlı | Uygulama işlevi |
| Cihaz/diğer kimlikler | Reklam açıksa⁴ | Reklam açıksa⁴ | İsteğe bağlı | Reklam |
| Uygulama etkileşimleri | Analitik açıksa⁵ | Analitik açıksa⁵ | İsteğe bağlı | Analitik |
| Satın alma geçmişi | **Evet (v1)**⁶ | **Evet (v1)**⁶ | Zorunlu | Uygulama işlevi |
| Konum | **Hayır** | Hayır | — | Cihaz konumu HİÇ okunmuyor; doğum yeri kullanıcının elle seçtiği şehir |
| Kişiler, takvim, SMS, dosyalar | **Hayır** | Hayır | — | Toplanmıyor |
| Sağlık ve fitness | **Hayır** | Hayır | — | Toplanmıyor |

¹ Anthropic (yorum üretimi) · ² RevenueCat; PostHog yalnızca analitik açıksa · ³ Yalnızca
kahve falı ritüelini kullanırsan · ⁴ AppLovin MAX · ⁵ PostHog · ⁶ RevenueCat,
Google Play

> **Bu üç satır YAPILANDIRMAYA BAĞLI. Onaylı v1 kapsamı:** RevenueCat ve Google
> Play satın almaları **AÇIK**; PostHog analitiği ve AppLovin reklamları
> **KAPALI**. Production derlemesinde RevenueCat Android anahtarı bulunmalı;
> PostHog, MAX ve reklam birimi anahtarları boş kalmalı. Bu nedenle v1 Data
> Safety formunda satın alma geçmişini **"Evet"**, cihaz/reklam kimlikleri ile
> uygulama etkileşimlerini **"Hayır"** olarak beyan et. Gelecekte analitik veya
> reklam açılırsa ilgili koşullu satırları ve Play beyanını birlikte güncelle.
>
> `npm run yetenek:check` hangisinin açık olduğunu söylüyor. Formu doldurmadan
> önce çalıştır ve çıktısına göre işaretle; bu tablo neyin mümkün olduğunu
> anlatıyor, neyin açık olduğunu değil.

**Doğum tarihi/saati/yeri:** Play'de bunun için ayrı bir kategori yok.
"Diğer kişisel bilgiler" (Other personal info) altında beyan et; amacı
"Uygulama işlevi", zorunlu.

### Silme ve saklama

- **Fotoğraflar:** Play formunda "veriler kalıcı olarak saklanmıyor,
  yalnızca geçici işleniyor" seçeneğini işaretle. Kod: `main.py`
  `setex(f"cupimg:{rid}", 86400, raw)` ve `tasks.py`
  `r.delete(f"cupimg:{reading_id}")` — işlem biter bitmez siliniyor,
  24 saat yalnızca üst sınır.
- **Diğer veriler:** silme talebine kadar saklanıyor; talep sonrası 24 saat
  içinde kalıcı siliniyor (`purge_deleted_users`).

### Veri silme URL'si

Play Console → Uygulama içeriği → Veri silme:

- **Uygulama içi silme yolu var mı:** Evet — Profil → Verilerimi sil
- **Web bağlantısı:** `https://telve.app/veri-silme.html`

---

## 2. Mağaza listesi

**Uygulama adı (30 karakter sınırı)**

```
Telve: Kahve Falı ve Astroloji
```

**Kısa açıklama (80 karakter)**

```
Fincanına gerçekten bakan, söylediğinin hesabını tutan fal ve astroloji.
```

**Tam açıklama (4000 karakter)**

```
Telve, fincanındaki gerçek şekilleri okuyan ve doğum haritanı gerçek gökyüzü
verisinden hesaplayan bir fal uygulaması.

FİNCANINA GERÇEKTEN BAKIYOR
Fotoğrafını çekiyorsun, telve şekilleri görüntü işleme ile çıkarılıyor ve
yorum bu şekillerin fincandaki KONUMUNA göre yazılıyor: sap tarafı sensin,
karşı taraf başkaları, ağıza yakın olan yakın günler, dip kalıcı olan.
Hazır metin döndürmüyor.

SÖYLEDİĞİNİN HESABINI TUTUYOR
Her fal, süresi belli olan tahminler üretiyor. Süre dolunca sana soruyor:
tuttu mu? Cevapların Kader Günlüğü'ne işleniyor ve isabet oranın açıkça
görünüyor — tutmayanlar da silinmiyor. Bunu yapan başka bir fal uygulaması
yok.

GÖKYÜZÜ HESAPLANIYOR, UYDURULMUYOR
Doğum haritan Swiss Ephemeris ile, doğduğun anın gerçek gezegen
konumlarından hesaplanıyor. Yükselen burcun için doğum saatin ve yerin
kullanılıyor; saatini bilmiyorsan da devam edebiliyorsun. Transitler senin
haritana göre hesaplanıyor, genel burç yorumu değil.

SENİ HATIRLIYOR
Daha önce anlattığın konular ve kişiler sonraki yorumlarda geri geliyor.
Her seferinde sıfırdan başlayan bir uygulama değil.

RİTÜELLER
• Kahve falı — fincanının fotoğrafını çek
• Tarot — günün kartı, üç kart, aşk açılımı
• Doğum haritası — karakter, ilişki, para, kariyer eksenlerinde
• Rüya yorumu — gördüğün sahneyi anlat; rüyanı gördüğün gecenin Ay'ıyla
  birlikte okunuyor
• Günün yorumu — her gün, haritana göre

NASIL ÇALIŞIYOR
Kayıt yok: e-posta, şifre, telefon istemiyoruz. Fincan fotoğrafın kalıcı
olarak saklanmıyor, yorum üretilir üretilmez siliniyor. Verilerini tek bir
dokunuşla, uygulama içinden kalıcı olarak sildirebiliyorsun.

Ücretsiz başlıyorsun: uygulamayı açtığında ilk falını bakmaya yetecek jetonun
hazır. Sonrasında tahminlerini değerlendirerek jeton kazanabilir veya abone
olabilirsin.

Uygulamadaki tüm yorumlar eğlence amaçlıdır. Tıbbi, hukuki veya finansal
tavsiye yerine geçmez. 18 yaş ve üzeri içindir.
```

> Açıklamadaki her cümle uygulamada karşılığı olduğu için böyle yazıldı.
> Reklamdan jeton kazanma cümlesi ÇIKARILDI: reklam SDK'sı şu anda derlemede
> yok, yani mağazada var denen bir şey uygulamada bulunmuyor olurdu. Reklamı
> açtığında bu cümleyi geri ekleyebilirsin.

**Kategori:** Yaşam Tarzı
**Etiketler:** fal, kahve falı, astroloji, doğum haritası, tarot, rüya yorumu

**Gizlilik politikası URL'si:** `https://telve.app/gizlilik.html`

---

## 3. İçerik derecelendirme anketi

Anketi doldururken kod gerçeği:

| Soru | Cevap |
|---|---|
| Şiddet içeriyor mu? | Hayır |
| Cinsel içerik var mı? | Hayır |
| Küfür var mı? | Hayır |
| Kontrollü madde referansı var mı? | Hayır |
| Kumar veya kumar simülasyonu var mı? | **Hayır.** Jeton satın alınabiliyor ama rastgele ödül, çekiliş veya bahis yok. Tarot kartı çekimi rastgele ama karşılığında ödül kazanılmıyor. |
| Kullanıcılar birbiriyle etkileşebiliyor mu? | Hayır |
| Konum paylaşılıyor mu? | Hayır |
| Dijital satın alma var mı? | **Evet** — jeton ve abonelik |
| Hedef yaş | **18+** |

**Not:** Fal/astroloji içeriği bazı ülkelerde ek uyarı gerektiriyor.
"Eğlence amaçlıdır" ifadesi hem uygulama içinde (profil ekranı, paylaşım
kartı, sonuç ekranı), hem mağaza açıklamasında, hem kullanım koşullarında
bulunuyor.

---

## 4. İzinler ve gerekçeleri

| İzin | Neden | Nerede isteniyor |
|---|---|---|
| `CAMERA` | Fincan fotoğrafı çekmek | Yalnızca kahve falı ritüeline girildiğinde |
| `POST_NOTIFICATIONS` | Transit bildirimleri | Onboarding'de, reddedilebilir |

Arka plan konumu, dosya erişimi veya rehber izni **yok**.

---

## 5. Abonelikler

**Play ürün kimlikleri koda gömülü DEĞİL.** İstemci, planları RevenueCat
offering'inden okuyor (`lib/purchases.ts`), yani ürün kimliklerini Play
Console'da serbestçe seçebilirsin.

**Sabit olan tek şey RevenueCat entitlement kimlikleri.** Sunucu, webhook'tan
gelen `entitlement_ids` değerini `normalize_tier()` ile eşliyor
(`app/core/pricing.py` → `TIER_LIMITS`) ve şu üçünü tanıyor:

| Entitlement kimliği | Katman | Kapsam |
|---|---|---|
| `star` | Yıldız | Ayda 10 fal, reklamsız |
| `fate` | Kader | Sınırsız fal, reklamsız |
| `yearly` | Yıllık | Sınırsız fal, reklamsız |

RevenueCat'te entitlement'ı başka bir adla kurarsan `normalize_tier()` onu en
düşük ücretli katmana (`star`) düşürüyor ve sunucu log'una uyarı yazıyor.
Kullanıcı hak kaybetmiyor ama **sınırsız katman satın alan kullanıcı ayda 10
fala düşer** — yani bu eşleşme gerçekten önemli, log'u yayından sonra kontrol
et.

**Abonelik şartlarının satın almadan önce görünmesi zorunlu.** Paywall
ekranında tam metin gösteriliyor (`ob.paywall.sartlar`) ve profil
ekranından kullanım koşullarına bağlantı var.

---

## 6. Reklamlar

> **Şu anda reklam YOK.** `react-native-applovin-max` bağımlılıklarda ve güncel
> API'yle bağlı, ancak `maxSdkKey` ve rewarded unit kimliği boş; sarmalayıcı
> anahtarlar yokken jeton kapısındaki
> "reklam izle" butonu hiç görünmüyor. Bu hâliyle Play Console'da
> **"Hayır, reklam içermiyor"** işaretlenmeli — olmayan reklamı beyan etmek
> de yanlış beyan.
>
> Reklamı açmak istediğinde: `app.json` → `extra.maxSdkKey` ve rewarded unit
> kimliklerini doldur,
> `npm run yetenek:check` yeşile dönsün, sonra bu bölümü ve Play Console
> ayarını güncelle. `yetenek:check` anahtar dolu / paket eksik durumunu
> hata olarak yakalıyor.

Reklam açıldığındaki tasarım:

- Yalnızca **ödüllü video**; kullanıcı izlemeyi kendisi seçiyor.
- Açılışta, geçişte veya banner reklam **yok**.
- Ödül jetonunu **sunucu** veriyor (`POST /v1/coins/reward`, günde 5 tavan).
  İstemci "izledim" deyip jeton basamıyor.

**Reklam kapalıyken jeton nereden geliyor:** açılış hediyesi (5), doğrulanan
her tahmin (+1) ve seri ödülleri (7/30/100. gün). Açılış hediyesi bu döngüyü
başlatabilmek için var — onsuz kullanıcı ilk falı bakamıyor, tahmin
üretilmiyor ve doğrulama ödülü hiç kazanılamıyordu.

---

## 7. Hassas konular

Bu uygulama kırılgan anlardaki kullanıcılara metin üretiyor. Mağaza
incelemesinde sorulursa dayanak:

- Kriz işareti tespit edilirse (kendine zarar, intihar) **yorum
  üretilmiyor**; kullanıcıya ülkesine ait acil yardım hatları gösteriliyor
  (Türkiye: 112 ve 183). Denetim sunucuda, üretimden önce çalışıyor ve o
  metin yapay zekâ sağlayıcısına gönderilmiyor.
  Kod: `app/core/guardrail.py`, `app/core/locales.py`.
- 18 yaş altı beyanında ilişki ve kader yorumu üretilmiyor.
- Çıktıda ölüm kehaneti, hastalık teşhisi, hamilelik iddiası, kesin finansal
  tutar ve üçüncü kişi suçlaması yasak; üretilen metin bu kalıplara karşı
  taranıyor ve yakalanırsa yeniden üretiliyor (`scan_output`).
