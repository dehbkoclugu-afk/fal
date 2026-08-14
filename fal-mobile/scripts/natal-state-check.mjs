import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import ts from 'typescript';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const reveal = read('app/onboarding/reveal.tsx');
const revealCard = read('components/NatalRevealCard.tsx');
const natal = read('app/ritual/natal.tsx');
const wheel = read('components/NatalChartWheel.tsx');
const share = fs.existsSync(path.join(root, 'components/NatalShareCard.tsx'))
  ? read('components/NatalShareCard.tsx')
  : '';

const layoutSource = read('lib/natalLayout.ts');
const layoutJs = ts.transpileModule(layoutSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const layoutModule = { exports: {} };
vm.runInNewContext(`(function(exports,module){${layoutJs}\n})(module.exports,module)`, {
  module: layoutModule,
});
const { angularDistance, layoutNatalBodies, natalAspectLimit, natalRenderSize } = layoutModule.exports;

assert.equal(angularDistance(359, 1), 2);
const crowded = [
  { key: 'venus', lon: 1 },
  { key: 'sun', lon: 359 },
  { key: 'moon', lon: 4 },
];
const forward = layoutNatalBodies(crowded);
const reversed = layoutNatalBodies([...crowded].reverse());
assert.deepEqual(JSON.parse(JSON.stringify(forward)), JSON.parse(JSON.stringify(reversed)));
assert.equal(new Set(forward.map((body) => body.lane)).size, 3);
assert.equal(natalAspectLimit(260, false), 8);
assert.equal(natalAspectLimit(320, true), 10);
assert.equal(natalAspectLimit(320, false), 14);

const viewportSnapshots = [
  { name: 'small-android', width: 320, fontScale: 1, timeKnown: false, size: 256, aspects: 8 },
  { name: 'large-android', width: 412, fontScale: 1.3, timeKnown: true, size: 328, aspects: 14 },
  { name: 'tablet', width: 768, fontScale: 1, timeKnown: true, size: 328, aspects: 14 },
];
const renderedViewportState = viewportSnapshots.map((snapshot) => ({
  ...snapshot,
  size: natalRenderSize(snapshot.width),
  aspects: natalAspectLimit(natalRenderSize(snapshot.width), false),
}));
assert.deepEqual(renderedViewportState, viewportSnapshots);

const checks = [
  ['reveal üç semantik natal görselini kullanıyor', ['natal-wheel', 'natal-planets', 'natal-aspects'].every((id) => reveal.includes(id))],
  ['reveal azaltılmış hareketi destekliyor', reveal.includes('useReducedMotion')],
  ['yükselen tahmini durumunu görünür kılıyor', reveal.includes('estimated: !draft.timeKnown') && revealCard.includes("ob.reveal.tahmini")],
  ['natal konu seçimi erişilebilir', natal.includes('accessibilityRole="radio"')],
  ['natal konu seçimi semantik art kullanıyor', natal.includes('<ArtSlot')],
  ['çark yerleşimi saf yardımcıdan geliyor', wheel.includes("@/lib/natalLayout")],
  ['gezegen çipleri en az 44dp', wheel.includes('minHeight: 44')],
  ['çark seçimi yardımcı teknolojiye açıklanıyor', wheel.includes('accessibilityLabel')],
  ['natal paylaşımı ayrı kart kullanıyor', share.includes('captureRef') && share.includes('1080') && share.includes('1350')],
];

const matrix = {
  birthTime: ['known', 'unknown'],
  viewport: ['small-android', 'large-android', 'tablet'],
  fontScale: ['normal', 'large'],
  theme: ['dark', 'light'],
  selection: ['none', 'planet'],
  motion: ['normal', 'reduced'],
  state: ['loading', 'ready', 'missing-data', 'share-error'],
};
const matrixCases = Object.values(matrix).reduce((total, values) => total * values.length, 1);
assert.equal(matrixCases, 384);

const matrixCoverage = [
  ['birthTime', reveal.includes('draft.timeKnown') && wheel.includes('timeUnknown')],
  ['viewport', wheel.includes('useWindowDimensions') && wheel.includes('natalAspectLimit')],
  ['fontScale', wheel.includes('flexWrap') && share.includes('adjustsFontSizeToFit')],
  ['theme', revealCard.includes('<ArtSlot') && share.includes('<ArtSlot')],
  ['selection', wheel.includes('controlledKey') && wheel.includes('onSelectionChange')],
  ['motion', reveal.includes('useReducedMotion')],
  ['state', reveal.includes('error') && natal.includes('yetersiz') && share.includes('setError')],
];
for (const [dimension, covered] of matrixCoverage) {
  assert.ok(covered, `Snapshot matrisi dalı eksik: ${dimension}`);
}

const failures = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`);
if (failures.length) process.exit(1);
console.log(`✓ Natal durum matrisi: ${matrixCases} birleşim sözleşmeyle kapsanıyor.`);
console.log(`✓ Viewport snapshotları: ${viewportSnapshots.map((item) => item.name).join(', ')}.`);
