/**
 * Türkçe metin kataloğu — referans dil.
 *
 * Yeni bir dil eklerken bu dosya kopyalanır ve NATIVE yazılır, çeviri
 * yapılmaz. Plan açıkça böyle diyor: çeviriyle giden ürün o pazarda hep
 * "yabancı" hissediliyor ve dönüşüm yarıya düşüyor.
 *
 * Katalog düz bir nesne, iç içe değil: anahtarlar `ekran.parça` biçiminde.
 * İç içe yapı, eksik anahtarı tip düzeyinde yakalamayı zorlaştırıyor.
 */
export const tr = {
  // --- ortak
  'ortak.devam': 'Devam et',
  'ortak.vazgec': 'Vazgeç',
  'ortak.vazgecKucuk': 'vazgeç',
  'ortak.kapat': 'kapat',
  'ortak.kapatEtiket': 'Kapat',
  'ortak.geriDon': 'Geri dön',
  'ortak.anaEkran': 'Ana ekrana dön',
  'ortak.anaEkranKucuk': 'ana ekrana dön',
  'ortak.tekrarDeneButon': 'Tekrar dene',

  // --- sunucu hata kodları
  //
  // Sunucu her hatayla birlikte hem sabit bir `code` hem de Türkçe bir
  // `message` yolluyor. Ekranda GÖSTERİLEN metin buradan geliyor: sunucu
  // metnini olduğu gibi basmak, Türkçe olmayan bir kullanıcıya Türkçe hata
  // göstermek demekti.
  'hata.daily_cap': 'Bugün için yeterince fal baktık. Yarın devam edelim.',
  'hata.insufficient_coins': 'Jetonun yetmiyor.',
  'hata.no_birth_data': 'Önce doğum bilgilerini tamamla.',
  'hata.reward_cap': 'Bugünlük ödül hakkın doldu.',
  'hata.unsupported_locale': 'Bu dil henüz desteklenmiyor.',
  'hata.network': 'Bağlantını kontrol edip tekrar dener misin?',
  'hata.network_timeout': 'Bağlantı uzun sürdü. Tekrar dener misin?',
  'hata.photo_unreadable': 'Fotoğrafı cihazdan okuyamadım. Yeniden çeker misin?',
  'hata.retry_limit': 'Bu yorum için ücretsiz yeniden deneme hakkı kullanıldı.',
  'hata.retry_in_progress': 'Yorum zaten yeniden hazırlanıyor.',
  'hata.retry_requires_photo': 'Kahve falı için fincanı yeniden çekmen gerekiyor.',
  'hata.invalid_cup_photo':
    'Fincanın içi seçilemiyor. Fincanı ortalayıp yukarıdan, net biçimde yeniden çek.',
  'hata.unknown': 'Bir şeyler ters gitti. Tekrar dene.',
  'ortak.jeton': '{n} jeton',
  'ortak.baglantiHatasi': 'Bağlantını kontrol edip tekrar dener misin?',
  'ortak.eglenceAmacli': 'eğlence amaçlıdır',
  'profil.surum': 'Telve {version} ({build}) · state v{state}',

  // --- onboarding
  'ob.isim.eyebrow': 'Başlarken',
  'ob.isim.soru': 'Sana ne diyeyim?',
  'ob.isim.aciklama':
    'Yorumlarda adını kullanacağım. Soyadına, e-postaya, şifreye gerek yok.',
  'ob.isim.placeholder': 'adın',

  'ob.dogum.eyebrow': '1 / 3 · doğum verisi',
  'ob.dogum.soru': 'Ne zaman doğdun?',
  'ob.dogum.tarih': 'Tarih',
  'ob.dogum.saat': 'Saat',
  'ob.dogum.saatimiBilmiyorum': 'Doğum saatimi bilmiyorum',
  // Tarih/saat yer tutucuları da dile bağlı: gg.aa.yyyy Türkiye'nin biçimi,
  // ABD'de aa/gg/yyyy olmalı.
  'ob.dogum.tarihOrnek': '14.06.1993',
  'ob.dogum.saatOrnek': '04:30',
  'ob.dogum.neden':
    'Gezegen konumlarını gerçek gökyüzü verisinden hesaplıyorum, o yüzden tarih ve saat gerekiyor.',

  'ob.yer.eyebrow': '2 / 3 · doğum verisi',
  'ob.yer.soru': 'Nerede doğdun?',
  'ob.yer.aciklama': 'Yükselen burcun doğduğun yerin enlemine göre değişiyor.',
  'ob.yer.ara': 'şehir ara',
  'ob.yer.bulunamadi': 'Bu isimde şehir yok. Yazımı kontrol et.',
  'ob.yer.devam': 'Haritamı çiz',

  // Halka ortasında iki satır olarak duruyor; satır sonu metnin parçası.
  'ob.reveal.hesaplaniyor': 'haritan\nçiziliyor',
  'ob.reveal.saatYokUyari':
    'Doğum saatini bilmediğin için yükselen tahmini. Sonradan profilinden ekleyebilirsin.',
  'ob.reveal.yukselen': 'Yükselen',
  'ob.reveal.yukselenNot': 'dışa dönük yüzün',
  'ob.reveal.gunes': 'Güneş',
  'ob.reveal.gunesNot': 'özün',
  'ob.reveal.ay': 'Ay',
  'ob.reveal.ayNot': 'duygun',
  'ob.reveal.kisisel': 'doğum verilerinden kişisel olarak hesaplandı',
  'ob.reveal.tahmini': 'TAHMİNİ',

  'ob.tani.eyebrow': 'Seni tanıyorum',
  'ob.tani.soru': 'Seni biraz daha tanıyayım',
  'ob.tani.neden':
    'Bu iki seçim yalnızca yorumun bağlamını belirler. İlişki durumunu paylaşmak istemezsen “Belirtmek istemiyorum” seçeneğini kullanabilirsin.',
  'ob.tani.iliskiDurumu': 'İlişki durumu',
  'ob.tani.merak': 'En çok neyi merak ediyorsun?',
  'ob.tani.iliskiYok': 'Şu anda ilişkide değilim',
  'ob.tani.iliskiVar': 'Bir ilişkim var',
  'ob.tani.evli': 'Evliyim / hayat ortağım var',
  'ob.tani.karisik': 'Durumum karmaşık',
  'ob.tani.belirtmekIstemiyorum': 'Belirtmek istemiyorum',
  'ob.tani.tekSecim': 'Yalnızca bir konu seç.',

  'ob.ton.eyebrow': 'Nasıl konuşayım',
  'ob.ton.soru': 'Hangi ses sana yakın?',
  'ton.nazik': 'Nazik',
  'ton.nazikOrnek': 'Zor bir dönemden geçiyorsun ama yalnız değilsin.',
  'ton.dobra': 'Dobra',
  'ton.dobraOrnek': 'Bu işi sen sürüncemede bırakıyorsun, gökyüzü değil.',
  'ton.mistik': 'Mistik',
  'ton.mistikOrnek': 'Fincanın dibinde bekleyen bir gölge var.',
  'ton.bilimsel': 'Açıklamalı',
  'ton.bilimselOrnek': 'Satürn 7. evinde: ilişkilerde sınır testi.',

  'ob.bildirim.eyebrow': 'Yaklaşan',
  'ob.bildirim.baslik': 'Haritanda bir hareket var',
  'ob.bildirim.hesaplandi':
    'Bu, senin doğum haritana göre hesaplandı — genel burç yorumu değil.',
  'ob.bildirim.yaklasan': 'Yaklaşan günler',
  'ob.bildirim.hareketli': 'Haritanda hareketli dönemler var',
  'ob.bildirim.hesaplaniyor':
    'Hesaplama sürüyor; hazır olduğunda sana bildireceğim.',
  'ob.bildirim.aciklama':
    'Böyle günler yaklaştığında haber vereyim mi? Günde en fazla iki bildirim gönderiyorum, gece hiç göndermiyorum.',
  'ob.bildirim.haberVer': 'Haber ver',
  'ob.bildirim.simdiDegil': 'Şimdi değil',

  'ob.paywall.baslik': 'Falın hazır',
  'ob.paywall.testBaslik': 'Test sürümündesin',
  'ob.paywall.baglantiBaslik': 'Bağlantı bekleniyor',
  'ob.paywall.ucretsizBaslik': 'Ücretsiz başlayabilirsin',
  'ob.paywall.altBaslik':
    'Ücretsiz kullanmaya devam edebilirsin. Abonelik kapsamı seçtiğin plana göre değişir.',
  'ob.paywall.ucretsizAltBaslik':
    'Mağaza şu anda hazır değil. Ritüelleri jetonla kullanabilir, günlük yorumunu ücretsiz okuyabilirsin.',
  'ob.paywall.testSurumu': 'TEST SÜRÜMÜ · SATIN ALMA KAPALI',
  'ob.paywall.ucretsizHaklar': 'Ücretsiz kullanım',
  'ob.paywall.premiumHaklar': 'Abonelik avantajları',
  'ob.paywall.ucretsizJeton': 'Başlangıç jetonlarıyla ritüelleri dene',
  'ob.paywall.ucretsizGunluk': 'Günün kişisel yorumunu ücretsiz oku',
  'ob.paywall.ucretsizGecmis': 'Hazırlanan yorumlarına geçmişten ulaş',
  'ob.paywall.natal': 'Doğum verilerine göre kişisel harita yorumu',
  'ob.paywall.transit': 'Kişisel transit uyarıları',
  'ob.paywall.reklamsiz': 'Reklamsız',
  'ob.paywall.aboneOl': 'Abone ol',
  'ob.paywall.magazaBaglaniliyor': 'Mağaza fiyatları yükleniyor…',
  'ob.paywall.magazaHazirDegil':
    'Bu test paketinde mağaza satın alımları kapalı. Ücretsiz akış eksiksiz çalışır.',
  'ob.paywall.cevrimdisi':
    'Mağazaya bağlanamadım. İnternet bağlantını kontrol edip yeniden deneyebilirsin.',
  'ob.paywall.planYok':
    'Mağaza bağlantısı kuruldu ancak yayınlanmış bir abonelik planı bulunamadı.',
  'ob.paywall.ucretsizDevam': 'Ücretsiz devam et',
  'ob.paywall.geriYukle': 'Satın alımı geri yükle',
  'ob.paywall.geriYuklenemedi': 'Geri yüklenecek bir abonelik bulamadım.',
  'ob.paywall.sartlar':
    'Abonelik otomatik yenilenir. Yenilemeden en az 24 saat önce mağaza hesabından iptal edebilirsin. Ücret onayladığın anda tahsil edilir. Fal içeriği eğlence amaçlıdır; tıbbi, hukuki veya finansal tavsiye yerine geçmez.',
  'ob.paywall.jetonNot':
    'Abone olmadan ritüeller jeton harcar. Jeton bakiyeni ana ekranda, her ritüelin ücretini başlamadan önce görebilirsin.',
  'ob.paywall.yillik': 'Yıllık',
  'ob.paywall.aylik': 'Aylık',
  'ob.paywall.haftalik': 'Haftalık',
  'ob.paywall.abonelik': 'Abonelik',
  'ob.paywall.yildaBir': 'yılda',
  'ob.paywall.aydaBir': 'ayda',
  'ob.paywall.haftadaBir': 'haftada',
  'ob.paywall.enAvantajli': 'en avantajlı',
  'ob.paywall.toplamYenileme': 'Toplam {fiyat} · {donem} otomatik yenilenir',

  // --- ana ekran
  'ana.merhaba': 'merhaba',
  'ana.sinirsiz': 'sınırsız',
  'ana.kalanFal': '{n} fal · {tier}',
  'ana.bugun': 'bugün',
  'ana.gunlukHazirlaniyor': 'Günün yorumu hazırlanıyor. Birazdan burada olacak.',
  'ana.gunlukHazirlanamadi': 'Günün yorumu hazırlanamadı. Biraz sonra yeniden dene.',
  'ana.gunlukTekrarDene': 'Günün yorumunu yeniden dene',
  'ana.falinHazir': 'Falın hazır. Geçmiş fallarından açabilirsin.',
  'ana.ritueller': 'ritüeller',
  'ana.dahil': 'dahil',
  'ana.hesabiSorulacak': 'hesabı sorulacak',
  'ana.tuttu': 'tuttu',
  'ana.kismen': 'kısmen',
  'ana.tutmadi': 'tutmadı',
  'ana.isabetOranin': 'isabet oranın',
  'ana.isabetOzet': '%{score} · {total} tahmin',
  'ana.defterOk': 'defter →',
  'ana.gecmis': 'geçmiş fallarım',
  'ana.gecmisOk': 'hepsi →',
  'ana.seri': '{n} gündür buradasın',
  'ana.seriOdul': ' · jeton kazandın',
  'gecmis.hazirlaniyor': 'Yorum hazırlanıyor…',
  'gecmis.basarisiz': 'Yorum hazırlanamadı · açıp yeniden dene',

  'ritual.kahve': 'Kahve falı',
  'ritual.kahveNot': 'fincanını çek',
  'ritual.tarot': 'Tarot',
  'ritual.tarotNot': 'kartını seç',
  'ritual.natal': 'Doğum haritası',
  'ritual.natalNot': 'karakter çözümü',
  'ritual.ruya': 'Rüya yorumu',
  'ritual.ruyaNot': 'gördüğünü anlat',

  // --- rüya ritüeli
  'ruya.eyebrow': 'rüya yorumu',
  'ruya.baslik': 'Ne gördün?',
  'ruya.aciklama':
    'Gördüğün sahneyi kendi cümlelerinle anlat. Rüya sözlüğüne bakmıyorum; anlattığın sahneyi haritanla ve rüyanı gördüğün gecenin gökyüzüyle birlikte okuyorum.',
  'ruya.placeholder': 'rüyanda ne oldu?',
  'ruya.neZaman': 'Ne zaman gördün?',
  'ruya.dunGece': 'dün gece',
  'ruya.oncekiGece': 'önceki gece',
  'ruya.cokKisa': 'Biraz daha anlatır mısın? Gördüğün sahneyi yazman yeterli.',
  'ruya.yorumla': 'Rüyamı yorumla',
  'ruya.yorumlaJeton': 'Rüyamı yorumla · {n} jeton',
  'ruya.haritasizNot':
    'Doğum bilgin olmadan da yorumluyorum; haritanı eklersen rüyanı o gecenin gökyüzüne de bağlarım.',

  // --- kahve ritüeli
  'kahve.izinBaslik': 'Kamera izni gerekiyor',
  'kahve.izinAciklama':
    'Sunucu kopyası yorumdan sonra, en geç 24 saatte silinir. Geçmişte işaretleri göstermek için cihazındaki kopya en fazla 30 gün tutulur.',
  'kahve.izinVer': 'İzin ver',
  'kahve.adimBaslik': 'Fincanın içi',
  'kahve.adimIpucu':
    'Fincanı ters çevirip beklettikten sonra içini yukarıdan çek. Sapı yukarı bakacak şekilde tut.',
  'kahve.sap': 'sap',
  'kahve.hazir': 'Fincan hazır',
  'kahve.soruEtiket': 'Aklında bir soru var mı?',
  'kahve.soruPlaceholder': 'istersen boş bırak',
  'kahve.oku': 'Fincanı oku',
  'kahve.yenidenCek': 'Yeniden çek',
  'kahve.fotografCek': 'Fotoğraf çek',

  // --- tarot ritüeli
  'tarot.eyebrow': 'tarot',
  'tarot.gununKarti': 'Günün kartı',
  'tarot.ucKart': 'Geçmiş · Şimdi · Gelecek',
  'tarot.askAcilimi': 'Aşk açılımı',
  'tarot.kartlarSecildi': 'Kartlar seçildi.',
  'tarot.acilimiOku': 'Açılımı oku · {n} jeton',
  'tarot.kartSec': 'Desteden {n} kart seç. Aklındaki soruyu düşün.',
  'tarot.kartNo': '{n}. kart',
  'tarot.ters': 'ters',
  'tarot.kartlarAciliyor': 'Seçtiğin gerçek kartlar açılıyor…',

  // --- natal ritüeli
  'natal.eyebrow': 'doğum haritası',
  'natal.baslik': 'Neye bakalım?',
  'natal.aciklama':
    'Haritan doğum anındaki gerçek gökyüzünden hesaplandı. Seçtiğin eksen, yorumun hangi gezegen ve evlere ağırlık vereceğini belirler.',
  'natal.butunHarita': 'Bütün harita',
  'natal.butunHaritaNot': 'Karakter, duygu, ilişki, iş — hepsi',
  'natal.ask': 'Aşk ve ilişkiler',
  'natal.askNot': 'Venüs, 5. ve 7. ev',
  'natal.para': 'Para ve güvence',
  'natal.paraNot': '2. ve 8. ev, Jüpiter',
  'natal.kariyer': 'İş ve yön',
  'natal.kariyerNot': 'MC, 6. ve 10. ev, Satürn',
  'natal.kendim': 'Kendim',
  'natal.kendimNot': 'Yükselen, Ay, Chiron',
  'natal.yorumla': 'Haritamı yorumla',
  'natal.yorumlaJeton': 'Haritamı yorumla · {n} jeton',
  'natal.odak': 'ODAK',
  'natal.secili': 'SEÇİLİ ODAK',
  'natal.ucretBaslik': 'YORUM HAKKI',
  'natal.aboneligeDahil': 'Aboneliğine dahil · jeton harcanmaz',
  'natal.bakiyeVeUcret': 'Bakiyen {bakiye} jeton · bu yorum {ucret} jeton',
  'natal.tekSeferNot': 'Yalnızca yorumu başlattığında bakiyenden düşer.',

  // --- hesaplanmış gökyüzü görselleri
  'harita.hesaplanmis': 'hesaplanmış doğum haritan',
  'harita.erisilebilir': 'Gezegenleri, evleri ve açıları gösteren doğum haritası çemberi',
  'harita.yukselen': 'YÜKSELEN',
  'harita.retro': 'retro',
  'harita.tahmini': 'YÜKSELEN TAHMİNİ',
  'harita.gezegenEtiket': '{gezegen}, {burc} burcunda {derece} derece',
  'harita.motor': 'Hesap motoru: {motor}',
  'harita.saatYok':
    'Doğum saatin bilinmediği için yükselen tahmini, ev çizgileri gizli. Gezegen burçları ve açılar geçerlidir.',
  'ruya.geceninGokyuzu': 'rüyayı gördüğün gecenin gökyüzü',
  'ruya.aydinlik': 'aydınlık',
  'ruya.etkinGostergeler': 'yoruma giren hesaplanmış göstergeler',
  'ruya.transitYok': 'O gece sıkı bir kişisel transit yoktu; yorum Ay fazına bağlandı.',
  'gezegen.sun': 'Güneş',
  'gezegen.moon': 'Ay',
  'gezegen.mercury': 'Merkür',
  'gezegen.venus': 'Venüs',
  'gezegen.mars': 'Mars',
  'gezegen.jupiter': 'Jüpiter',
  'gezegen.saturn': 'Satürn',
  'gezegen.uranus': 'Uranüs',
  'gezegen.neptune': 'Neptün',
  'gezegen.pluto': 'Plüton',

  // --- sonuç ekranı
  'sonuc.kahveFali': 'kahve falı',
  'sonuc.tarot': 'tarot',
  'sonuc.natal': 'doğum haritası',
  'sonuc.ruya': 'rüya yorumu',
  'sonuc.yorum': 'yorum',
  'sonuc.neYapmali': 'ne yapmalı',
  'sonuc.defteryeYazildi': 'deftere yazıldı',
  'sonuc.tahminNotu':
    'Süre dolunca sana soracağım: tuttu mu? Cevabın Kader Günlüğü\'ne işlenecek.',
  'sonuc.gunlugeGit': 'Kader Günlüğü\'ne git',
  'sonuc.getirilemedi': 'Falı getiremedim. Bağlantını kontrol edip tekrar dene.',
  'sonuc.bosSonuc': 'Bu yorum tamamlanamadı. Jetonun harcanmadı; daha sonra yeniden deneyebilirsin.',
  'sonuc.bekleme.coffee1': 'fincan çevriliyor',
  'sonuc.bekleme.coffee2': 'telve yerleşiyor',
  'sonuc.bekleme.coffee3': 'kenarlara bakılıyor',
  'sonuc.bekleme.coffee4': 'dibe iniliyor',
  'sonuc.bekleme.tarot1': 'deste karıştırılıyor',
  'sonuc.bekleme.tarot2': 'kartlar açılıyor',
  'sonuc.bekleme.tarot3': 'semboller okunuyor',
  'sonuc.bekleme.tarot4': 'açılım bağlanıyor',
  'sonuc.bekleme.natal1': 'gökyüzü hesaplanıyor',
  'sonuc.bekleme.natal2': 'evler çiziliyor',
  'sonuc.bekleme.natal3': 'açılar kuruluyor',
  'sonuc.bekleme.natal4': 'haritan yorumlanıyor',
  'sonuc.bekleme.dream1': 'gecenin Ayı bulunuyor',
  'sonuc.bekleme.dream2': 'rüya sahnesi açılıyor',
  'sonuc.bekleme.dream3': 'semboller bağlanıyor',
  'sonuc.bekleme.dream4': 'yorum hazırlanıyor',
  'sonuc.bekleme.daily1': 'bugünün gökyüzü açılıyor',
  'sonuc.bekleme.daily2': 'transitler hesaplanıyor',
  'sonuc.bekleme.daily3': 'göstergeler birleşiyor',
  'sonuc.bekleme.daily4': 'günün yorumu hazırlanıyor',
  'sonuc.bekleme.a11yCoffee': 'Kahve falı bekleme ritüeli',
  'sonuc.bekleme.a11yTarot': 'Tarot açılımı bekleme ritüeli',
  'sonuc.bekleme.a11yNatal': 'Doğum haritası bekleme ritüeli',
  'sonuc.bekleme.a11yDream': 'Rüya yorumu bekleme ritüeli',
  'sonuc.bekleme.a11yDaily': 'Günün yorumu bekleme ritüeli',
  'sonuc.beklemeKaydi': 'Okuma kaydı bulunuyor…',
  'sonuc.beklenendenUzun': 'Beklenenden uzun sürüyor; yorumun kaybolmadı.',
  'sonuc.beklemeDurum': '{adim} / 4 · işleniyor',
  'sonuc.beklemeDurumSureli': '{adim} / 4 · yaklaşık {sure} sn kaldı',
  'sonuc.beklemeNot': 'Hazır olduğunda haber vereceğim. Uygulamayı kapatabilirsin.',
  'sonuc.beklemePushYok':
    'Bu ekranda bekleyebilir veya ana ekrandan daha sonra tekrar kontrol edebilirsin.',
  'sonuc.ucretsizYenidenDene': 'Jeton harcamadan yeniden dene',
  'sonuc.yenidenDenenemedi': 'Bu yorum yeniden başlatılamadı. Ritüele dönebilirsin.',
  'sonuc.krizBaslik': 'Bir dakika duralım',
  'sonuc.acilYardim': 'acil yardım',
  'sonuc.destekHatti': 'sosyal destek hattı, 7/24',
  'sonuc.olmadi': 'Olmadı',
  'sonuc.okuyamadim': 'Fincanı okuyamadım',
  'sonuc.okuyamadimAciklama':
    'Fotoğrafı yukarıdan, fincanın içi net görünecek şekilde tekrar çekelim. Jetonun geri yüklendi.',

  // --- geçmiş fallar
  'gecmis.eyebrow': 'geçmiş fallarım',
  'gecmis.bos': 'Henüz fal bakmadın.',
  'gecmis.bosMetin':
    'Baktığın her fal burada kalıyor; istediğin zaman geri dönüp okuyabilirsin.',
  'gecmis.ilkFal': 'İlk falına bak',
  'gecmis.getirilemedi': 'Geçmişini getiremedim. Bağlantını kontrol edip tekrar dene.',

  // --- kader günlüğü
  'gunluk.eyebrow': 'kader günlüğü',
  'gunluk.cevabinIcin': 'cevabın için',
  'gunluk.bugununGokyuzu': 'bugünün hesaplanmış gökyüzü',
  'gunluk.konuyaGore': 'konuya göre',
  'gunluk.cevabiniBekliyorum': 'cevabını bekliyorum',
  'gunluk.ozet': '{total} tahmin · {hits} tuttu · {partials} kısmen',
  'gunluk.defterBos': 'Defter boş',
  'gunluk.henuzYok':
    'Henüz değerlendirilmiş tahmin yok. İlk falından sonra burası dolmaya başlar.',
  'gunluk.defterBosMetin':
    'Her fal, süresi belli olan iddialar üretiyor. Süre dolunca sana soruyorum: tuttu mu? Cevapların burada birikiyor ve tutmayanlar da silinmiyor.',
  'gunluk.aciklama':
    'Yorumlar eğlence amaçlıdır. İsabet oranı senin kendi değerlendirmelerine dayanır.',

  // --- profil
  'profil.eyebrow': 'profil',
  'profil.ad': 'ad',
  'profil.dogum': 'doğum',
  'profil.saat': 'saat',
  'profil.yer': 'yer',
  'profil.ton': 'ton',
  'profil.jetonSatir': 'jeton',
  'profil.seri': 'seri',
  'profil.seriGun': '{n} gün',
  'profil.bilinmiyor': 'bilinmiyor',
  'profil.dil': 'dil',
  'profil.dilYenidenBaslat':
    'Yazı yönü değişti. Düzenin tam oturması için uygulamayı kapatıp açman gerekiyor.',
  'profil.yasalMetin':
    'Uygulamadaki tüm yorumlar eğlence amaçlıdır. Tıbbi, hukuki veya finansal tavsiye yerine geçmez.',
  'profil.verileriSil': 'Verilerimi sil',
  'profil.siliniyor': 'siliniyor…',
  'profil.gizlilik': 'Gizlilik politikası',
  'profil.kosullar': 'Kullanım koşulları',
  'profil.silOnayBaslik': 'Verilerin silinsin mi?',
  'profil.silOnayMetin':
    'Doğum bilgilerin, fal geçmişin ve tahmin defterin kalıcı olarak silinir. Bu işlem geri alınamaz.',
  'profil.sil': 'Sil',
  'profil.silinemedi': 'Silinemedi',

  // --- jeton kapısı
  'kapi.baslik': 'jeton gerekiyor',
  'kapi.metin': 'Bu ritüel {gerekli} jeton. Şu an {mevcut} jetonun var.',
  'kapi.reklamIzle': 'Reklam izle · +1 jeton',
  'kapi.reklamYukleniyor': 'reklam yükleniyor…',
  'kapi.veyaSinirsiz': 'veya sınırsız kullan',
  'kapi.sinirsizKullan': 'Sınırsız kullan',
  'kapi.odulKazandin': '+1 jeton · toplam {n}',
  'kapi.odulBitti': 'Bugünlük ödül hakkın doldu. Yarın devam edelim.',
  'kapi.reklamHazirDegil': 'Reklam henüz hazır değil, birazdan tekrar dene.',
  'kapi.videoTamamlanmadi': 'Video tamamlanmadı.',
  'kapi.reklamGosterilemiyor': 'Şu an reklam gösteremiyorum.',

  // --- paylaşım
  'paylas.buton': 'paylaş',
  'paylas.hazirlaniyor': 'hazırlanıyor…',
  'paylas.hata': 'Paylaşamadım. Tekrar dener misin?',
  'paylas.cikanSembol': 'çıkan sembol · {sembol}',
  'paylas.gununYorumu': 'günün yorumu',
  'paylas.natalBaslik': 'DOĞUM HARİTAM',
  'paylas.natalKisisel': 'Gökyüzündeki imzam',
  'paylas.seciliGosterge': 'SEÇİLİ GÖSTERGE',

  // --- fincan overlay bölge adları
  'fincan.ipucu': 'İşaretlere dokun, fincanın neresi olduğunu göster',
  'fincan.rim': 'ağız — çok yakın',
  'fincan.upper': 'üst — yakın günler',
  'fincan.middle': 'orta — şu an',
  'fincan.lower': 'alt — süregelen',
  'fincan.bottom': 'dip — kalıcı, geçmiş',
  'fincan.handle': 'sap tarafı — sen',
  'fincan.opposite': 'karşı taraf — başkaları',
  'fincan.left': 'sol — geride kalan',
  'fincan.right': 'sağ — gelen',

  // --- konu adları (backend pricing.TOPICS ile eşleşmeli)
  'konu.ask': 'aşk',
  'konu.para': 'para',
  'konu.kariyer': 'iş ve kariyer',
  'konu.aile': 'aile',
  'konu.saglik': 'sağlık',
  'konu.kendim': 'kendim',
  'konu.genel': 'genel',
} as const;

export type Anahtar = keyof typeof tr;
