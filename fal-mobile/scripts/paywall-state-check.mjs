import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

const compilePureModule = async (path) => {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(`(function(exports,module){${js}\n})(module.exports,module)`, { module });
  return module.exports;
};

const { paywallTitleKey, sortStorePlans } = await compilePureModule('../lib/paywallModel.ts');
assert.equal(paywallTitleKey('ready'), 'ob.paywall.baslik');
assert.equal(paywallTitleKey('misconfigured'), 'ob.paywall.testBaslik');
assert.equal(paywallTitleKey('offline'), 'ob.paywall.baglantiBaslik');
assert.equal(paywallTitleKey('empty'), 'ob.paywall.ucretsizBaslik');
assert.equal(
  sortStorePlans([
    { identifier: 'weekly', period: 'P1W' },
    { identifier: 'annual', period: 'P1Y' },
    { identifier: 'monthly', period: 'P1M' },
  ]).map((plan) => plan.identifier).join(','),
  'annual,monthly,weekly',
);

const screen = await readFile(new URL('../app/onboarding/paywall.tsx', import.meta.url), 'utf8');
for (const state of ['loading', 'ready', 'empty', 'offline', 'misconfigured', 'purchase-error']) {
  assert.ok(screen.includes(`'${state}'`), `Paywall ${state} durumunu açıkça ele almalı`);
}
for (const contract of ['PlanSkeletons', 'planErrors[item.key]', 'GIZLILIK_URL', 'KOSULLAR_URL']) {
  assert.ok(screen.includes(contract), `Paywall sözleşmesi eksik: ${contract}`);
}
console.log('✓ Paywall loading/ready/empty/offline/misconfigured/purchase-error sözleşmesi doğrulandı.');
