# Telve art-slot sistemi

Telve'nin içerik yüzeyleri yazı kutuları değil, kahve falının malzeme
dünyasından gelen küçük sahnelerdir. Görseller ağdan yüklenmez; uygulamayla
birlikte gelir ve her kimlik için `dark` / `light` çifti bulunur.

## Semantik registry

Ekranlar dosya adı seçmez; `lib/artAssets.ts` içindeki `resolveArt(group, key,
surface)` sözleşmesini kullanır. Kimlikler dört gruptadır:

- `ritual`: coffee, tarot, dream ve natal; her ritüelin üç ayrı semantik sahnesi.
- `topic`: love, money, career, self ve general.
- `state`: free, premium, loading ve failed.
- `editorial`: daily, history, ledger ve share.

Önceki OTA paketlerinin kullandığı on sabit kimlik korunur. Yeni ürün yüzeyleri
semantik registry'ye geçer. Bilinmeyen konu yalnız `topic/general` varlığına
düşebilir; grup değiştiren fallback yoktur. Coffee varlığı tarot, dream ve natal
yüzeylerine bağlanamaz.

## Kurallar

- Görsel kartın tamamını kaplar; Android için katman kaydırılmaz veya daraltılmaz.
- Yazı okunurluğu gradient ile değil, düz ve düşük opaklıklı telve perdesiyle korunur.
- Yeni yüzeyler ritüel, konu, durum veya editorial anahtarını açıkça çözer. Yalnız
  eski dinamik geçmiş satırları OTA uyumu için deterministik hash havuzunu kullanır.
- Görsellerde yazı, logo, yüz, el, neon ve jenerik uzay gradyanı kullanılmaz.
- Sol taraf metin için sakin, ana nesne sağ tarafta ve küçük kartta tanınabilirdir.
- Kart master oranı 3:2 ve bütçesi 300 KB'dir.
- Hero master oranı 16:9 ve bütçesi 300 KB'dir.
- Share master oranı 4:5 ve bütçesi 500 KB'dir.
- Her kimliğin ayrı `dark` ve `light` kompozisyonu vardır; tema sürümü yalnız
  parlaklık filtresiyle türetilmez.
- `scripts/art-check.mjs` eksik çift, registry dışı dosya, yanlış oran, büyük
  dosya ve yasak coffee/yüzey eşleşmesini CI'da reddeder.

## Üretim kaydı

Dalga 2'de 25 yeni kimlik için 50 özgün kaynak görsel OpenAI yerleşik görsel
üretimiyle ayrı ayrı oluşturuldu ve WebP'ye dönüştürüldü. Ortak brief: sinematik
editoryal natürmort; sıcak espresso kahvesi, oksitlenmiş bakır, porselen kremi ve
ölçülü çini mavisi; solda sakin metin alanı, sağda 160×100 önizlemede tanınan ana
nesne; yazı, logo, yüz, el, marka ve neon uzay gradyanı yok.

Yeni kimlikler:

- `coffee-cup`, `coffee-grounds`, `coffee-saucer`
- `tarot-deck`, `tarot-spread`, `tarot-candle`
- `dream-moon`, `dream-window`, `dream-water`
- `natal-wheel`, `natal-planets`, `natal-aspects`
- `love`, `money`, `career`, `self`, `general`
- `free`, `premium`, `loading`, `failed`
- `editorial-daily`, `editorial-history`, `editorial-ledger`, `editorial-share`

Legacy kimlikler: `coffee`, `tarot`, `natal`, `dream`, `daily`, `verify`,
`ledger`, `history`, `prediction`, `profile`.
