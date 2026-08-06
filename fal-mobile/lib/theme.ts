/**
 * Tasarım tokenları.
 *
 * YÖN: Bu uygulama gece göğü paletini KULLANMIYOR. Kahve falının gerçek malzeme
 * dünyasından geliyor: telve (sıcak koyu kahve, siyah değil), bakır cezve,
 * porselen fincanın çini mavisi kenarı. Rakiplerin tamamı lacivert + altın yıldız
 * kullanıyor; oradan çıkmak tek başına görsel farklılaşma sağlıyor.
 *
 * İKİ KAYIT: Ürün iki farklı sesle konuşuyor ve tipografi bunu taşıyor.
 *   ritual → Newsreader italic. Yorumun kendisi. Yavaş, sıcak, imgesel.
 *   ledger → JetBrains Mono. Kader Günlüğü ve isabet paneli. Tabular, süssüz.
 * Bu ayrım "doğrulanabilir fal" tezinin görsel karşılığı: kehanet mistik,
 * hesabı klinik. Kimse böyle yapmıyor.
 */

export const color = {
  // Yüzeyler — telvenin kendisi. Hepsi sıcak tarafta, hiçbiri nötr gri değil.
  telve: '#16100E',        // en dip zemin
  cezve: '#241A16',        // yükseltilmiş kart
  cezveUst: '#30231D',     // basılı / seçili hâl
  cizgi: '#3C2C24',        // hairline

  // Aksanlar
  bakir: '#C87942',        // birincil — bakır. CTA, streak, aktif durum.
  bakirSolgun: '#8A5430',
  cini: '#3A6EA5',         // ikincil — fincan kenarının çini mavisi.
                           // Sadece "tuttu" ve veri bağlamında kullanılır.
  kiremit: '#B04A34',      // "tutmadı" ve hata

  // Metin
  porselen: '#EFE7DA',     // birincil metin
  kul: '#9A897D',          // ikincil metin
  kulKoyu: '#6B5C52',      // üçüncül / devre dışı
} as const;

export const font = {
  // Görüntü yüzü — kısıtlı kullanılır: başlıklar ve fal metni.
  displayRegular: 'Newsreader_400Regular',
  displayItalic: 'Newsreader_400Regular_Italic',
  displayMedium: 'Newsreader_500Medium',

  // Gövde / arayüz
  bodyRegular: 'Karla_400Regular',
  bodyMedium: 'Karla_500Medium',
  bodyBold: 'Karla_700Bold',

  // Veri — defter kaydı, tarih, oran, tahmin satırı
  monoRegular: 'JetBrainsMono_400Regular',
  monoMedium: 'JetBrainsMono_500Medium',
} as const;

/** Tip ölçeği. Adlar rol belirtiyor, boyut değil. */
export const type = {
  // Ritüel kaydı
  oracle: { fontFamily: font.displayItalic, fontSize: 19, lineHeight: 31 },
  oracleLead: { fontFamily: font.displayRegular, fontSize: 25, lineHeight: 34 },
  title: { fontFamily: font.displayMedium, fontSize: 30, lineHeight: 36 },

  // Arayüz kaydı
  body: { fontFamily: font.bodyRegular, fontSize: 15, lineHeight: 23 },
  bodyStrong: { fontFamily: font.bodyMedium, fontSize: 15, lineHeight: 23 },
  label: { fontFamily: font.bodyMedium, fontSize: 13, lineHeight: 18 },
  button: { fontFamily: font.bodyBold, fontSize: 16, lineHeight: 20 },

  // Defter kaydı
  data: { fontFamily: font.monoRegular, fontSize: 13, lineHeight: 20 },
  dataStrong: { fontFamily: font.monoMedium, fontSize: 13, lineHeight: 20 },
  // Küçük büyük harf etiketler — bölüm ayırıcı olarak, süs olarak değil
  eyebrow: {
    fontFamily: font.monoRegular, fontSize: 11, lineHeight: 14,
    letterSpacing: 1.4, textTransform: 'uppercase' as const,
  },
  figure: { fontFamily: font.monoMedium, fontSize: 40, lineHeight: 44 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 20, xl: 32, xxl: 48 } as const;

/** Köşe yarıçapı: kart yumuşak, fincan tam daire, defter satırı köşeli. */
export const radius = { sm: 6, md: 14, lg: 22, full: 9999 } as const;

/** Hareket. Tek orkestre edilmiş an var (fincan açılışı); gerisi sessiz. */
export const motion = {
  quick: 180,
  settle: 420,
  ritual: 1400,   // telve halkasının dolma süresi
} as const;

export const hitStyle = {
  hit: { label: 'tuttu', color: color.cini },
  partial: { label: 'kısmen', color: color.bakir },
  miss: { label: 'tutmadı', color: color.kiremit },
  pending: { label: 'bekliyor', color: color.kulKoyu },
} as const;

export type Verdict = keyof typeof hitStyle;
