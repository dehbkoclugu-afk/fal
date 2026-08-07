/**
 * Yasal sayfa kontrolü.
 *
 * İki şeyi doğruluyor:
 *
 * 1. DOLDURULMAMIŞ YER TUTUCU KALDI MI. Gizlilik politikasında
 *    `[[SIRKET_ADI]]` yazarken yayına çıkmak, Google Play incelemesinde
 *    ret sebebi ve KVKK açısından veri sorumlusunun hiç bildirilmemesi
 *    demek. Bu yüzden kontrol, uyarı değil HATA veriyor.
 *
 * 2. UYGULAMANIN GÖSTERDİĞİ ADRESLER GERÇEKTEN VAR MI. Profil ekranındaki
 *    bağlantı `public/` altında karşılığı olmayan bir dosyayı gösteriyorsa
 *    kullanıcı 404 görür — ve mağaza incelemesi de öyle.
 *
 * `npm run yasal:check` ile çalışır. Yayın öncesi zorunlu.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const KOK = process.cwd();
let hata = 0;

const YER_TUTUCU = /\[\[([A-Z_]+)\]\]/g;

// --- 1. Yer tutucular
const dosyalar = (await readdir(join(KOK, 'public')))
  .filter((d) => d.endsWith('.html'));

const eksik = new Map();     // yer tutucu → dosyalar
for (const d of dosyalar) {
  const kaynak = await readFile(join(KOK, 'public', d), 'utf8');
  for (const m of kaynak.matchAll(YER_TUTUCU)) {
    if (!eksik.has(m[1])) eksik.set(m[1], new Set());
    eksik.get(m[1]).add(d);
  }
}

console.log(`yasal sayfa: ${dosyalar.length} dosya`);

if (eksik.size) {
  console.error(`\n✗ ${eksik.size} yer tutucu doldurulmamış — bu hâliyle yayına çıkamaz:`);
  for (const [ad, nerede] of eksik) {
    console.error(`   [[${ad}]]  →  ${[...nerede].join(', ')}`);
  }
  console.error('\n   Doldur ve tekrar çalıştır. Şirket unvanı ve adresi KVKK');
  console.error('   aydınlatma metninin zorunlu unsuru; boş bırakılamaz.');
  hata++;
} else {
  console.log('✓ doldurulmamış yer tutucu yok');
}

// --- 2. Uygulamadaki bağlantılar gerçek dosyayı gösteriyor mu
const profil = await readFile(join(KOK, 'app/(tabs)/profile.tsx'), 'utf8');
const yollar = [...profil.matchAll(/\$\{YASAL_KOK\}(\/[\w.-]+)/g)].map((m) => m[1]);

const kirik = yollar.filter((y) => !dosyalar.includes(y.slice(1)));
if (kirik.length) {
  console.error(`\n✗ uygulamadaki ${kirik.length} bağlantının karşılığı yok:`);
  kirik.forEach((y) => console.error(`   ${y}  →  public${y} bulunamadı`));
  hata++;
} else {
  console.log(`✓ uygulamadaki ${yollar.length} yasal bağlantının karşılığı var`);
}

// --- 3. Sayfalar birbirine bağlı mı (ölü uç kalmasın)
for (const d of dosyalar) {
  const kaynak = await readFile(join(KOK, 'public', d), 'utf8');
  for (const m of kaynak.matchAll(/href="(\/[\w.-]+\.html)"/g)) {
    const hedef = m[1].slice(1);
    if (!dosyalar.includes(hedef)) {
      console.error(`✗ ${d} → ${m[1]} bulunamadı`);
      hata++;
    }
  }
}

process.exit(hata ? 1 : 0);
