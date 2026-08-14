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
const { angularDistance, layoutNatalBodies, natalAspectLimit } = layoutModule.exports;

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

const failures = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`);
if (failures.length) process.exit(1);
