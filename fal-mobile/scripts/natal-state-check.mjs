import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const reveal = read('app/onboarding/reveal.tsx');
const revealCard = read('components/NatalRevealCard.tsx');
const natal = read('app/ritual/natal.tsx');
const wheel = read('components/NatalChartWheel.tsx');
const share = fs.existsSync(path.join(root, 'components/NatalShareCard.tsx'))
  ? read('components/NatalShareCard.tsx')
  : '';

const checks = [
  ['reveal üç semantik natal görselini kullanıyor', ['natal-wheel', 'natal-planets', 'natal-aspects'].every((id) => reveal.includes(id))],
  ['reveal azaltılmış hareketi destekliyor', reveal.includes('useReducedMotion')],
  ['yükselen tahmini durumunu görünür kılıyor', reveal.includes('estimated: !draft.timeKnown') && revealCard.includes("ob.reveal.tahmini")],
  ['natal konu seçimi erişilebilir', natal.includes('accessibilityRole="radio"')],
  ['natal konu seçimi semantik art kullanıyor', natal.includes('<ArtSlot')],
  ['çark yerleşimi saf yardımcıdan geliyor', wheel.includes("@/lib/natalLayout")],
  ['çark seçimi yardımcı teknolojiye açıklanıyor', wheel.includes('accessibilityLabel')],
  ['natal paylaşımı ayrı kart kullanıyor', share.includes('captureRef') && share.includes('1080') && share.includes('1350')],
];

const failures = checks.filter(([, ok]) => !ok);
for (const [label, ok] of checks) console.log(`${ok ? '✓' : '✗'} ${label}`);
if (failures.length) process.exit(1);
