import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const ids = [
  'coffee', 'tarot', 'natal', 'dream', 'daily',
  'verify', 'ledger', 'history', 'prediction', 'profile',
];

const missing = ids.flatMap((id) => ['dark', 'light']
  .map((mode) => join(root, 'assets', 'art', `${id}-${mode}.webp`))
  .filter((path) => !existsSync(path)));

if (missing.length) {
  console.error(`Eksik art varyantı:\n${missing.join('\n')}`);
  process.exit(1);
}

const registry = readFileSync(join(root, 'lib', 'artAssets.ts'), 'utf8');
const unregistered = ids.filter((id) => !registry.includes(`${id}: {`));
if (unregistered.length) {
  console.error(`Registry kaydı eksik: ${unregistered.join(', ')}`);
  process.exit(1);
}

console.log(`✓ ${ids.length} kimlik / ${ids.length * 2} yerel art varyantı tamam`);
