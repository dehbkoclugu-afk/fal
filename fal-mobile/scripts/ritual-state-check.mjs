import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const source = await readFile(new URL('../lib/ritualWaiting.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const module = { exports: {} };
vm.runInNewContext(`(function(exports,module){${js}\n})(module.exports,module)`, { module });

const { RITUAL_WAITING_MODELS: models, monotonicProgress, readingSurface, waitingStage } = module.exports;
assert.equal(Object.keys(models).join(','), 'coffee,tarot,natal,dream,daily');
assert.equal(models.coffee.keyword, 'fincan');
assert.equal(models.tarot.keyword, 'deste');
assert.equal(models.dream.keyword, 'gece');
assert.equal(models.natal.keyword, 'gökyüzü');
for (const [kind, model] of Object.entries(models)) {
  assert.equal(model.kind, kind);
  assert.equal(model.visualKind, kind);
  assert.ok(model.titleKey);
  assert.ok(model.accessibilityKey);
  assert.equal(model.stageKeys.length, 4);
  if (kind !== 'coffee') assert.ok(!model.stageKeys.join(' ').includes('coffee'));
}
assert.equal(monotonicProgress(0.7, 0.2), 0.7);
assert.equal(waitingStage(0.99), 3);
for (const kind of Object.keys(models)) {
  assert.equal(readingSurface('queued', false), 'queued', kind);
  assert.equal(readingSurface('running', false), 'running', kind);
  assert.equal(readingSurface('running', true), 'slow', kind);
  assert.equal(readingSurface('failed', false), 'failed', kind);
  assert.equal(readingSurface('done', false), 'done', kind);
}
console.log('✓ Ritüel bekleme kimliği, aşamaları ve monoton ilerleme doğrulandı.');
