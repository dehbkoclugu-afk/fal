# Telve — 100 Maddelik Tasarım Geliştirme Yol Haritası

Bu yol haritası 13 Ağustos 2026 tarihli Android ekran kayıtları ve `main` dalındaki kod incelemesine dayanır.

## P0 — Paywall ve satın alma

1. Paywall durumlarını loading, ready, empty, offline, misconfigured ve purchase-error olarak ayır.
2. RevenueCat anahtarı olmayan preview APK'yı açık test modu olarak tanımla.
3. Production derlemesini RevenueCat anahtarı yoksa CI'da durdur.
4. Boş plan listesini satış sayfası gibi göstermeyi bırak.
5. Mağaza yokken ekranı sade ücretsiz başlangıç yüzeyine dönüştür.
6. Mağaza hatasında görünür yeniden deneme eylemi sun.
7. Satın alma SDK'sını paywall açılmadan önce hazırla.
8. Fiyat yüklenirken yüksekliği sabit skeleton plan kartları göster.
9. Planları dönem sırasına göre deterministik sırala.
10. Fiyat, dönem, toplam ücret ve yenilenmeyi aynı kartta açıkla.
11. Paywall üstüne kişisel gökyüzü hero artı ekle.
12. Hero yüksekliğini ekranın yüzde 28'iyle sınırla.
13. Başlığı mağaza ve kullanıcı durumuna göre dinamikleştir.
14. Ücretsiz hakları paywall'da görünür göster.
15. Abonelik ve jeton sistemini ayrı bloklarda anlat.
16. Ücretsiz devam ile abone ol eylemlerinin hiyerarşisini netleştir.
17. Kapatma eylemini Android status bar'dan güvenli mesafede tut.
18. Restore, koşullar ve gizlilik bağlantılarını her durumda erişilebilir bırak.
19. Satın alma hatasını ilgili plan kartında göster.
20. Paywall için tüm durumlarda screenshot testleri ekle.

## P0 — Ritüel bekleme durumu

21. Reading API yanıtında kind alanını zorunlu yap.
22. Kind bilinmiyorsa coffee varsayımı yerine okuma kaydını bekle.
23. İkon, başlık, aşama ve erişilebilirlik metnini tek WaitingModel'dan üret.
24. Ritüel başına sabit ve semantik anahtar kelime kullan.
25. 1/4 göstergesini ritüele özgü aşama adıyla birleştir.
26. Tarot ikonu ile fincan metnini aynı anda render etmeyi testle engelle.
27. Rüya ikonu ile fincan metnini aynı anda render etmeyi testle engelle.
28. Natal ikonu ile fincan metnini aynı anda render etmeyi testle engelle.
29. Eski OTA/AsyncStorage metnini state sürümüyle geçersizleştir.
30. Uygulama ve bundle sürümünü profil debug alanında göster.
31. Süreyi sunucu ilerlemesiyle senkronize et.
32. İlerleme halkasının geriye gitmesini engelle.
33. Uzun süren iş için ayrı slow durumu ekle.
34. Ana ekranda hazırlanıyor durumunu geçmiş kartında göster.
35. Push yokken uygulama içi hazır bildirimi göster.
36. Başarısız iş için jeton harcamadan yeniden deneme sun.
37. Boş sonuç otomatik retry sayısını sınırla.
38. Günlük yorum hatasına ana ekranda retry eylemi ekle.
39. Arka arkaya başarısız üretimleri telemetriye kaydet.
40. Queued, running, slow, failed ve done test matrisi oluştur.

## P1 — Semantik art sistemi

- [x] 41. Rastgele kahve fotoğrafı havuzunu ürün yüzeylerinden kaldır.
- [x] 42. Her artı ritüel, konu ve kullanım yüzeyi anahtarıyla eşleştir.
- [x] 43. Art kimliklerini ritual, topic, state ve editorial gruplarına ayır.
- [x] 44. Kahve için üç özgün semantik art üret.
- [x] 45. Tarot için üç özgün semantik art üret.
- [x] 46. Rüya için üç özgün semantik art üret.
- [x] 47. Natal için üç özgün semantik art üret.
- [x] 48. Aşk, para, kariyer, benlik ve genel için beş konu artı üret.
- [x] 49. Daily, history, ledger ve share için dört editorial art üret.
- [x] 50. Paywall için free ve premium hero artları üret.
- [x] 51. Yeni seti en az 24 semantik varlığa tamamla.
- [x] 52. Her artın dark ve light sürümünü üret.
- [x] 53. Kart, hero ve paylaşım master oranlarını standardize et.
- [x] 54. Ana nesneyi metin güvenli alanından uzak tut.
- [x] 55. Görsel içine yazı, logo veya okunması gereken sembol koyma.
- [x] 56. Kahve nesnesini natal ve tarot bağlamında kullanma.
- [x] 57. Bakır, porselen, gece mavisi ve telve paletini sabitle.
- [x] 58. 160x100 önizlemede tanınabilirlik kontrolü yap.
- [x] 59. WebP kalite ve boyut bütçesi belirle.
- [x] 60. Eksik çift, yanlış oran ve büyük dosyayı CI'da reddet.

## P1 — Doğum haritası deneyimi

- [x] 61. Reveal ekranındaki Yükselen, Güneş ve Ay satırlarına semantik mini art ekle.
- [x] 62. Kahve fotoğrafı yerine astrolojik konu artı kullan.
- [x] 63. Loading çarkını gerçek sonuç çarkıyla aynı görsel aileye bağla.
- [x] 64. Haritan çiziliyor metnini merkez diske yerleştir.
- [x] 65. Yükselen, Güneş ve Ay'ı ayrı bilgi kartları yap.
- [x] 66. Burç glifi, derece ve kısa anlamı birlikte göster.
- [x] 67. Bilinmeyen doğum saatinde Yükselen'i tahmin olarak işaretle.
- [x] 68. Natal konu seçimlerinde beş konu artını kullan.
- [x] 69. Seçili konu artını daha aydınlık göster.
- [x] 70. CTA üstünde fiyat, bakiye ve abonelik durumunu göster.
- [x] 71. Burç, ev, gezegen ve açıları ayrı görsel katmanlar yap.
- [x] 72. Yakın gezegen glifleri için çakışma çözümü ekle.
- [x] 73. Sert ve uyumlu açıları farklı renklerle kodla.
- [x] 74. Açı yoğunluğunu ekran boyutuna göre azalt.
- [x] 75. Seçilen gezegeni çark ve detayda birlikte vurgula.
- [x] 76. Gezegen chiplerini responsive grid yap.
- [x] 77. Harita etkileşim alanlarını en az 44x44 dp yap.
- [x] 78. Teknik ephemeris etiketini yardım içeriğine taşı.
- [x] 79. Paylaşım için yüksek çözünürlüklü ayrı render üret.
- [x] 80. Saat var/yok, dar ekran ve büyük yazı snapshot testleri ekle.

Dalga 2 kabul kanıtı: semantik registry ve CI `ff46674`; 50 yeni WebP `c97c65e`;
reveal `20df028`; odak/ödeme `645a165`; deterministik çark `bd9d592`; natal
paylaşımı `d1762b2`. `art:check`, `natal-state:check` ve tam `ci:check` sözleşmeleri
otomatik doğrulamadır. Küçük Android, büyük Android ve tablet viewport snapshotları
saf render-state çıktılarıyla sabitlenir; bu kayıt gerçek cihaz doğrulaması iddiası değildir.

## P2 — Ana ekran ve ritüel kartları

81. Başarısız günlük yorumda kahve fotoğrafı kullanma.
82. Başarısız daily için özel state artı göster.
83. Hazırlanıyor kartında aşama ve retry zamanı göster.
84. Kart ikonuyla artın birbirini gereksiz tekrar etmesini engelle.
85. Uzun ritüel başlıklarının taşmasını önle.
86. Kart açıklamalarını iki satırla sınırla.
87. Jeton fiyatını kartın sabit alt bölgesine hizala.
88. Tüm kart yüzeyini erişilebilir dokunma alanı yap.
89. Boş geçmiş bölümündeki gereksiz alanı kaldır.
90. Küçük Android, büyük Android ve tablet regresyon testleri ekle.

## P3 — Sistem kalitesi ve yayın kabulü

91. Serif, sans ve monospace tipografi matrisi oluştur.
92. Büyük sistem fontunda kırpılmayı engelle.
93. Metin/art kontrastını WCAG AA ile denetle.
94. Reduce Motion için sade animasyon modu ekle.
95. TalkBack etiketlerini bütün ritüellere ekle.
96. Yalnız renkle anlatılan seçimlere şekil desteği ekle.
97. Her kritik ekran için durum tasarım sözleşmesi oluştur.
98. Samsung status/navigation bar ölçüleriyle screenshot testi çalıştır.
99. UI düzeltmeleri ile bitmap art varlıklarını ayrı commit checkpointlerinde tut.
100. Yayın kabulünü CI, gerçek cihaz, sandbox satın alma, doğru bekleme metni ve semantik natal art şartlarına bağla.

## Uygulama sırası

- Dalga 1: 1–40 — kırık paywall, bekleme kimliği ve hata kurtarma.
- Dalga 2: 41–80 — semantik art üretimi ve doğum haritası.
- Dalga 3: 81–100 — sistem geneli kalite, erişilebilirlik ve yayın kapısı.
