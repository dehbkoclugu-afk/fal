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
| 4 | `app.json` içindeki `extra` anahtarlarını doldur (RevenueCat, PostHog, MAX) | ⬜ |
| 5 | `versionCode`'u artır | ⬜ |
| 6 | `npm run release:check` | ⬜ |

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
| Kullanıcı kimlikleri (User IDs) | Evet | Evet² | Zorunlu | Uygulama işlevi, analitik |
| Fotoğraflar | **Evet** | **Evet¹** | İsteğe bağlı³ | Uygulama işlevi |
| Diğer kullanıcı içeriği (soru ve rüya metni) | Evet | Evet¹ | İsteğe bağlı | Uygulama işlevi |
| Cihaz/diğer kimlikler | Evet | Evet⁴ | İsteğe bağlı | Reklam, analitik |
| Uygulama etkileşimleri | Evet | Evet⁵ | İsteğe bağlı | Analitik |
| Satın alma geçmişi | Evet | Evet⁶ | Zorunlu | Uygulama işlevi |
| Konum | **Hayır** | Hayır | — | Cihaz konumu HİÇ okunmuyor; doğum yeri kullanıcının elle seçtiği şehir |
| Kişiler, takvim, SMS, dosyalar | **Hayır** | Hayır | — | Toplanmıyor |
| Sağlık ve fitness | **Hayır** | Hayır | — | Toplanmıyor |

¹ Anthropic (yorum üretimi) · ² PostHog, RevenueCat · ³ Yalnızca kahve falı
ritüelini kullanırsan · ⁴ AppLovin MAX · ⁵ PostHog · ⁶ RevenueCat, Google Play

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

Ücretsiz kullanabilirsin. Jetonla ritüel açabilir, reklam izleyerek jeton
kazanabilir veya abone olabilirsin.

Uygulamadaki tüm yorumlar eğlence amaçlıdır. Tıbbi, hukuki veya finansal
tavsiye yerine geçmez. 18 yaş ve üzeri içindir.
```

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

- Yalnızca **ödüllü video**; kullanıcı izlemeyi kendisi seçiyor.
- Açılışta, geçişte veya banner reklam **yok**.
- Play Console → Uygulama içeriği → Reklamlar: **"Evet, reklam içeriyor"**.
- Ödül jetonunu **sunucu** veriyor (`POST /v1/coins/reward`, günde 5 tavan).
  İstemci "izledim" deyip jeton basamıyor.

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
