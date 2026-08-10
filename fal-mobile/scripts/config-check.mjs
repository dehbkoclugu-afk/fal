import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const release = process.argv.includes('--release');
const sentinels = {
  EXPO_PUBLIC_API_URL: 'https://sentinel.invalid',
  EXPO_PUBLIC_RC_ANDROID_KEY: 'goog_sentinel_public_key',
  EAS_PROJECT_ID: '00000000-0000-0000-0000-000000000000',
};
const env = {
  ...process.env,
  EXPO_NO_TELEMETRY: '1',
  ...(release ? {} : sentinels),
};
const sonuc = spawnSync('npx', ['expo', 'config', '--type', 'public', '--json'], {
  cwd: process.cwd(),
  env,
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (sonuc.status !== 0) {
  console.error('Expo public config üretilemedi.');
  process.exit(1);
}

let expo;
try {
  expo = JSON.parse(sonuc.stdout);
} catch {
  console.error('Expo public config JSON olarak okunamadı.');
  process.exit(1);
}

const extra = expo.extra ?? {};
const disabled = ['posthogKey', 'maxSdkKey', 'maxAndroidRewardedUnit', 'maxIosRewardedUnit'];
// Expo 57 public config serializes JSON null values as empty objects.
const kapali = (value) => value === null || (
  value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0
);
const doluMetin = (value) => typeof value === 'string' && value.trim().length > 0;

if (!release) {
  assert.equal(extra.apiUrl, sentinels.EXPO_PUBLIC_API_URL);
  assert.equal(extra.rcAndroidKey, sentinels.EXPO_PUBLIC_RC_ANDROID_KEY);
  assert.equal(extra.eas?.projectId, sentinels.EAS_PROJECT_ID);
  for (const key of disabled) assert.ok(kapali(extra[key]), `${key} v1'de kapalı olmalı`);
  console.log('✓ Expo yapılandırması ortam değerlerini kullanıyor; reklam ve analitik kapalı.');
  process.exit(0);
}

const hatalar = [];
if (!/^https:\/\//.test(extra.apiUrl ?? '')) hatalar.push('EXPO_PUBLIC_API_URL geçerli bir HTTPS adresi olmalı.');
if (!doluMetin(extra.rcAndroidKey)) hatalar.push('EXPO_PUBLIC_RC_ANDROID_KEY eksik.');
if (!doluMetin(extra.eas?.projectId)) hatalar.push('EAS_PROJECT_ID eksik.');
for (const key of disabled) {
  if (!kapali(extra[key])) hatalar.push(`${key} v1 için null olmalı.`);
}

if (hatalar.length) {
  console.error('Release yapılandırması hazır değil:');
  for (const hata of hatalar) console.error(`  ✗ ${hata}`);
  process.exit(1);
}

console.log('✓ Release yapılandırması hazır; reklam ve analitik v1 için kapalı.');
