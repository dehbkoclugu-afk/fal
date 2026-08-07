/**
 * Web dışa aktarımı sonrası düzeltme.
 *
 * Expo Router'ın statik render'ı react-helmet kullanıyor ve hiçbir ekran
 * başlık vermediğinde `<title data-rh="true"></title>` (BOŞ) basıyor. Bu
 * etiket belge kabuğundaki (`app/+html.tsx`) başlığımızdan ÖNCE geliyor ve
 * HTML'de ilk <title> geçerli olduğu için sekme ve paylaşılan link önizlemesi
 * boş görünüyor.
 *
 * Ekran seviyesinde başlık vermek de çözmedi (kök layout'taki <Head> statik
 * render'da uygulanmıyor), o yüzden boş etiketi burada kaldırıyoruz.
 *
 * package.json > build:web bunu otomatik çağırıyor; elle çalıştırmak
 * gerekmiyor.
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const KOK = process.argv[2] ?? 'dist-web';
const BOS_TITLE = /<title data-rh="true">\s*<\/title>/g;

async function* htmlDosyalari(dizin) {
  for (const girdi of await readdir(dizin, { withFileTypes: true })) {
    const yol = join(dizin, girdi.name);
    if (girdi.isDirectory()) yield* htmlDosyalari(yol);
    else if (girdi.name.endsWith('.html')) yield yol;
  }
}

let duzeltilen = 0;
for await (const dosya of htmlDosyalari(KOK)) {
  const icerik = await readFile(dosya, 'utf8');
  if (!BOS_TITLE.test(icerik)) continue;
  await writeFile(dosya, icerik.replace(BOS_TITLE, ''));
  duzeltilen++;
}

console.log(`postexport: ${duzeltilen} sayfada boş <title> kaldırıldı`);
