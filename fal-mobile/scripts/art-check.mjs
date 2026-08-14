import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const artDir = join(root, 'assets', 'art');
const registry = readFileSync(join(root, 'lib', 'artAssets.ts'), 'utf8');
const entries = [...registry.matchAll(
  /^\s*(?:'([^']+)'|([a-z][\w-]*)):\s*(card|hero|share)\(\{[^\n]*?id:\s*'([^']+)'[^\n]*?surfaces:\s*\[([^\]]*)\][^\n]*?dark:\s*require\('\.\.\/assets\/art\/([^']+)'\)[^\n]*?light:\s*require\('\.\.\/assets\/art\/([^']+)'\)/gm,
)].map((match) => ({
  property: match[1] ?? match[2],
  ratio: match[3],
  id: match[4],
  surfaces: [...match[5].matchAll(/'([^']+)'/g)].map((surface) => surface[1]),
  dark: match[6],
  light: match[7],
}));

assert.equal(entries.length, 35, 'Registry satırları çözümlenemedi veya kimlik sayısı değişti');
assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length, 'Tekrarlanan art kimliği var');
assert.ok(entries.length >= 24, 'En az 24 semantik art kimliği gerekli');

function dimensions(path) {
  const bytes = readFileSync(path);
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `WebP RIFF başlığı eksik: ${path}`);
  assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `WebP imzası eksik: ${path}`);
  const chunk = bytes.toString('ascii', 12, 16);
  const data = 20;
  if (chunk === 'VP8X') {
    return {
      width: 1 + bytes.readUIntLE(data + 4, 3),
      height: 1 + bytes.readUIntLE(data + 7, 3),
    };
  }
  if (chunk === 'VP8 ') {
    return {
      width: bytes.readUInt16LE(data + 6) & 0x3fff,
      height: bytes.readUInt16LE(data + 8) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    const b1 = bytes[data + 1];
    const b2 = bytes[data + 2];
    const b3 = bytes[data + 3];
    const b4 = bytes[data + 4];
    return {
      width: 1 + b1 + ((b2 & 0x3f) << 8),
      height: 1 + (b2 >> 6) + (b3 << 2) + ((b4 & 0x0f) << 10),
    };
  }
  assert.fail(`Desteklenmeyen WebP chunk türü ${chunk}: ${path}`);
}

const expectedRatio = { card: 3 / 2, hero: 16 / 9, share: 4 / 5 };
const registeredFiles = new Set();

for (const entry of entries) {
  assert.equal(entry.property, entry.id, `Registry property/id uyuşmuyor: ${entry.property}/${entry.id}`);
  for (const [variant, file] of [['dark', entry.dark], ['light', entry.light]]) {
    const path = join(artDir, file);
    assert.ok(existsSync(path), `Eksik ${variant} art varyantı: ${file}`);
    registeredFiles.add(file);
    const { width, height } = dimensions(path);
    const delta = Math.abs(width / height - expectedRatio[entry.ratio]) / expectedRatio[entry.ratio];
    assert.ok(delta <= 0.01, `Yanlış oran ${file}: ${width}x${height}, beklenen ${entry.ratio}`);
    const budget = entry.ratio === 'share' ? 500000 : 300000;
    assert.ok(statSync(path).size <= budget, `Art bütçesi aşıldı ${file}: ${statSync(path).size}/${budget}`);
  }
}

for (const file of readdirSync(artDir).filter((name) => name.endsWith('.webp'))) {
  assert.ok(registeredFiles.has(file), `Registry dışı art dosyası: ${file}`);
}

const coffeeEntries = entries.filter((entry) => entry.id === 'coffee' || entry.id.startsWith('coffee-'));
for (const entry of coffeeEntries) {
  for (const forbidden of ['tarot-card', 'dream-card', 'natal-card', 'natal-topic', 'natal-reveal']) {
    assert.ok(!entry.surfaces.includes(forbidden), `Coffee art yasak yüzeyde: ${entry.id}/${forbidden}`);
  }
}

const tarotAtlas = join(root, 'assets', 'tarot', 'rws-atlas.webp');
assert.ok(existsSync(tarotAtlas), `Tarot atlası eksik: ${tarotAtlas}`);
const tarotRegistry = readFileSync(join(root, 'lib', 'tarotAtlas.ts'), 'utf8');
for (const marker of ['TAROT_ATLAS_COLUMNS = 13', 'TAROT_ATLAS_ROWS = 6']) {
  assert.ok(tarotRegistry.includes(marker), `Tarot atlas geometrisi eksik: ${marker}`);
}

console.log(`✓ ${entries.length} kimlik / ${entries.length * 2} yerel art varyantı + 78 kartlık tarot atlası doğrulandı`);
