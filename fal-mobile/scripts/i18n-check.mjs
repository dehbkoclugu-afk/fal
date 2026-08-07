/**
 * i18n bütünlük kontrolü.
 *
 * İki şeyi doğruluyor:
 *
 * 1. KAYITLI HER DİLİN KATALOĞU TAM MI. Yarım bir dil, kullanıcıya iki dil
 *    karışık gösterir — Türkçe fallback'e düşen Arapça bir ekran, hiç
 *    çevrilmemiş olmasından daha kötü. Eksik anahtar varsa çıkış kodu 1.
 *
 * 2. EKRANLARDA GÖMÜLÜ METİN KALDI MI. Katalog dışında kalan Türkçe bir
 *    dize, dil değiştirildiğinde ekranda Türkçe olarak kalır. Sezgisel bir
 *    tarama; kesin değil ama kaçanları yüzeye çıkarıyor.
 *
 * `npm run i18n:check` ile çalışır.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const KOK = process.cwd();
let hata = 0;

// --- 1. Katalog bütünlüğü
const trKaynak = await readFile(join(KOK, 'lib/i18n/tr.ts'), 'utf8');
const trAnahtarlar = new Set(
  [...trKaynak.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]),
);

const indexKaynak = await readFile(join(KOK, 'lib/i18n/index.ts'), 'utf8');
const kayitli = [...indexKaynak.matchAll(/\{\s*code:\s*'([^']+)'/g)].map((m) => m[1]);

console.log(`referans katalog (tr): ${trAnahtarlar.size} anahtar`);
console.log(`kayıtlı diller: ${kayitli.join(', ')}`);

for (const kod of kayitli) {
  if (kod === 'tr') continue;
  let kaynak;
  try {
    kaynak = await readFile(join(KOK, `lib/i18n/${kod}.ts`), 'utf8');
  } catch {
    console.error(`  ✗ ${kod}: lib/i18n/${kod}.ts bulunamadı`);
    hata++;
    continue;
  }
  const anahtarlar = new Set([...kaynak.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]));
  const eksik = [...trAnahtarlar].filter((k) => !anahtarlar.has(k));
  const fazla = [...anahtarlar].filter((k) => !trAnahtarlar.has(k));
  if (eksik.length || fazla.length) {
    console.error(`  ✗ ${kod}: ${eksik.length} eksik, ${fazla.length} fazla anahtar`);
    eksik.slice(0, 8).forEach((k) => console.error(`      eksik: ${k}`));
    fazla.slice(0, 8).forEach((k) => console.error(`      fazla: ${k}`));
    hata++;
  } else {
    console.log(`  ✓ ${kod}: tam (${anahtarlar.size} anahtar)`);
  }
}

// --- 1b. Kullanılmayan anahtar
//
// Ölü anahtar bedava değil: eklenen HER dil onu da çevirmek zorunda ve
// katalog bütünlük kontrolü eksikse derlemeyi kırıyor. Yani kimsenin
// görmediği bir metin için her dilde emek harcanıyor.
//
// Anahtarlar her zaman `t('...')` içinde geçmiyor — veri tablolarında çıplak
// dize olarak durup sonra t()'ye veriliyorlar (ODAKLAR, SPREADS gibi). Bu
// yüzden arama, tırnak içindeki geçişe bakıyor.
async function* kaynakDosyalari(dizin) {
  for (const g of await readdir(dizin, { withFileTypes: true })) {
    const yol = join(dizin, g.name);
    if (g.isDirectory()) yield* kaynakDosyalari(yol);
    else if (/\.(tsx?|jsx?)$/.test(g.name)) yield yol;
  }
}

let tumKaynak = '';
for (const dizin of ['app', 'components', 'lib']) {
  for await (const dosya of kaynakDosyalari(join(KOK, dizin))) {
    if (dosya.includes('/lib/i18n/')) continue;   // kataloğun kendisi sayılmaz
    tumKaynak += await readFile(dosya, 'utf8');
  }
}

// `hata.*` anahtarları sunucudan gelen kodla çalışma anında kuruluyor
// (`hata.${code}`), kaynakta düz metin olarak geçmiyorlar.
const DINAMIK = /^hata\./;

const olu = [...trAnahtarlar].filter(
  (k) => !DINAMIK.test(k) && !tumKaynak.includes(`'${k}'`));
if (olu.length) {
  console.error(`\n✗ ${olu.length} anahtar hiçbir yerde kullanılmıyor:`);
  olu.slice(0, 20).forEach((k) => console.error(`   ${k}`));
  hata++;
} else {
  console.log('✓ ölü anahtar yok');
}

// --- 2. Ekranlarda kalan gömülü Türkçe
async function* tsxDosyalari(dizin) {
  for (const g of await readdir(dizin, { withFileTypes: true })) {
    const yol = join(dizin, g.name);
    if (g.isDirectory()) yield* tsxDosyalari(yol);
    else if (g.name.endsWith('.tsx') && g.name !== '+html.tsx') yield yol;
  }
}

// Türkçe'ye özgü harf içeren, çeviri gerektirmesi muhtemel diziler.
const TR_HARF = /[çğıöşüÇĞİÖŞÜ]/;

/**
 * Kullanıcıya metin taşıyan JSX öznitelikleri.
 *
 * Bunlar Türkçe harf içermeyebilir ("Devam et", "Abone ol") — o yüzden
 * TR_HARF sezgisi burada işe yaramıyor ve öznitelik adından gidiyoruz.
 * İlk taramada bu sınıfın tamamı kaçtı: çift tırnaklı `label="Devam et"`
 * onlarca ekranda Türkçe kaldı.
 */
const METIN_OZNITELIK = /\b(label|placeholder|title|accessibilityLabel|accessibilityHint)\s*=\s*"([^"]+)"/g;

/**
 * JSX metin düğümü: `<Text>Defter boş</Text>`.
 *
 * İki tuzağı var, ikisi de gerçek kaçaklar üretti:
 *
 * 1. İÇERİDE İFADE OLABİLİYOR — `<Text>çıkan sembol · {symbol}</Text>`.
 *    İlk sürüm `{` görünce eşleşmiyordu; önce ifadeleri söküyoruz.
 *
 * 2. DÜĞÜM SATIRA SIĞMAYABİLİYOR. Profildeki yasal metin üç satıra
 *    yayılmıştı ve satır satır bakan tarayıcı için hiçbir satır tek başına
 *    "metin düğümü" gibi görünmüyordu. Bu yüzden bu tarama satır değil
 *    DOSYA üzerinde çalışıyor; karakter sınıfı `\n` içeriyor.
 */
const JSX_METIN = />([^<>]+)</g;
const JSX_IFADE = /\{[^{}]*\}/g;

/**
 * Kod artığı ayıklayıcı.
 *
 * Dosya genelinde `>` ile `<` arasına bakınca, iki JSX etiketi ARASINDAKİ
 * kod da yakalanıyor (`{pending && (` gibi). Gerçek bir metin düğümünde bu
 * karakterler bulunmuyor. Kalanında bunlardan biri varsa metin değil, koddur.
 *
 * `;` ve `:` bu listede DEĞİL: Türkçe düzyazı ikisini de kullanıyor ve
 * listeye koymak abonelik şartları metnini (mağaza zorunluluğu) taramanın
 * dışına atmıştı — tam olarak kaçmaması gereken metin.
 */
const KOD_IZI = /[{}()=&|[\]$`"<>]/;

/** İç içe süslü parantezleri (`${...}` gibi) bitene kadar söker. */
function ifadeleriSok(metin) {
  let onceki;
  do {
    onceki = metin;
    metin = metin.replace(JSX_IFADE, '');
  } while (metin !== onceki);
  return metin;
}

const kacanlar = [];
for (const dizin of ['app', 'components']) {
  for await (const dosya of tsxDosyalari(join(KOK, dizin))) {
    const satirlar = (await readFile(dosya, 'utf8')).split('\n');
    let yorumda = false;
    let atla = false;
    let atlaSonraki = false;
    // Taramanın dışında kalan satırlar (yorum ve i18n-ignore). Dosya
    // genelindeki JSX taraması da bunlara saygı duymak zorunda.
    const atlanan = new Set();
    satirlar.forEach((satir, i) => {
      const disari = () => atlanan.add(i);
      // `i18n-ignore` yorumu izleyen SATIRI taramadan çıkarıyor: çeviri
      // metni olmayan ama Türkçe harf içeren diziler (şehir adları gibi
      // arama anahtarları, marka adı) için.
      //
      // `i18n-ignore-blok` ise `];` / `};` görene kadar sürüyor. Blok
      // varsayılan değil: kapanışı kaçırıp yarım ekranı sessizce taramanın
      // dışında bırakıyordu.
      if (satir.includes('i18n-ignore-blok')) { atla = true; disari(); return; }
      if (atla) {
        disari();
        if (satir.includes('];') || satir.includes('};')) atla = false;
        return;
      }
      if (satir.includes('i18n-ignore')) { atlaSonraki = true; disari(); return; }
      if (atlaSonraki) { atlaSonraki = false; disari(); return; }
      const kirp = satir.trim();
      if (kirp.startsWith('/*')) yorumda = true;
      if (yorumda) {
        disari();
        if (kirp.includes('*/')) yorumda = false;
        return;
      }
      if (kirp.startsWith('//') || kirp.startsWith('*')) { disari(); return; }
      const bildir = (d) =>
        kacanlar.push(`${dosya.replace(KOK + '/', '')}:${i + 1}  '${d.slice(0, 50)}'`);

      // a) tek tırnaklı Türkçe diziler
      for (const m of satir.matchAll(/'([^']{3,})'/g)) {
        const d = m[1];
        if (!TR_HARF.test(d)) continue;
        if (d.startsWith('@/') || d.includes('/')) continue;   // yol
        bildir(d);
      }
      // b) metin taşıyan öznitelikler — Türkçe harf şartı aranmıyor
      for (const m of satir.matchAll(METIN_OZNITELIK)) bildir(m[2]);
    });

    // c) JSX metin düğümleri — satır değil DOSYA üzerinde, çünkü düğüm
    //    birden fazla satıra yayılabiliyor. Taramanın dışında kalan
    //    satırlar boşaltılıyor ki satır numaraları kaymasın.
    const govde = satirlar
      .map((s, i) => (atlanan.has(i) ? '' : s))
      .join('\n');

    for (const m of govde.matchAll(JSX_METIN)) {
      // `=>` okunun sağ tarafı metin düğümü değil, kod.
      if (govde[m.index - 1] === '=') continue;
      const d = ifadeleriSok(m[1]).replace(/\s+/g, ' ').trim();
      if (d.length < 3) continue;
      if (!/[A-Za-zÇĞİÖŞÜçğıöşü]{3,}/.test(d)) continue;
      if (KOD_IZI.test(d)) continue;
      const satirNo = govde.slice(0, m.index).split('\n').length;
      kacanlar.push(`${dosya.replace(KOK + '/', '')}:${satirNo}  '${d.slice(0, 50)}'`);
    }
  }
}

if (kacanlar.length) {
  console.error(`\n✗ katalog dışında ${kacanlar.length} Türkçe dize kaldı:`);
  kacanlar.slice(0, 20).forEach((x) => console.error('   ' + x));
  hata++;
} else {
  console.log('\n✓ ekranlarda gömülü Türkçe dize kalmadı');
}

process.exit(hata ? 1 : 0);
