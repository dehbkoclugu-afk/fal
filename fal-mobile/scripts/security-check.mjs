import { spawnSync } from 'node:child_process';

// Temporary, narrowly scoped waiver. image-size is reachable only through
// Metro's local build pipeline; Telve never parses user-supplied ICNS/JXL/HEIF
// files at runtime. Upstream currently has no patched release (<=2.0.2).
const allowedAdvisories = new Set([
  'https://github.com/advisories/GHSA-w3rx-r6r6-pgpr',
  'https://github.com/advisories/GHSA-5p2g-fcmc-qvqq',
]);

const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  shell: process.platform === 'win32',
});

if (!result.stdout) {
  console.error(result.stderr || 'npm audit çıktı üretmedi');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch {
  console.error('npm audit JSON çıktısı okunamadı');
  process.exit(1);
}

const vulnerabilities = report.vulnerabilities ?? {};
const unsafe = new Set();

for (const [name, issue] of Object.entries(vulnerabilities)) {
  const direct = issue.via.filter((via) => typeof via === 'object');
  if (direct.some((via) => !allowedAdvisories.has(via.url))) unsafe.add(name);
}

let changed = true;
while (changed) {
  changed = false;
  for (const [name, issue] of Object.entries(vulnerabilities)) {
    if (unsafe.has(name)) continue;
    if (issue.via.some((via) => typeof via === 'string' && unsafe.has(via))) {
      unsafe.add(name);
      changed = true;
    }
  }
}

if (unsafe.size) {
  console.error(`İzin verilmeyen npm güvenlik bulguları: ${[...unsafe].join(', ')}`);
  process.exit(1);
}

const waived = Object.values(vulnerabilities).some((issue) =>
  issue.via.some((via) => typeof via === 'object' && allowedAdvisories.has(via.url)),
);
console.log(waived
  ? '✓ audit temiz (Metro/image-size için 2 build-time DoS duyurusu yamalı sürüm çıkana kadar dar kapsamda izinli)'
  : '✓ npm audit yüksek/kritik bulgu yok');
