import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const kaynak = await readFile('lib/api.ts', 'utf8');

assert.match(kaynak, /new AbortController\(\)/, 'shared request AbortController kullanmalı');
assert.match(kaynak, /setTimeout\([^]*30_000\)/, 'timeout 30 saniye olmalı');
assert.match(kaynak, /signal:\s*controller\.signal/, 'fetch timeout signalini almalı');
assert.match(kaynak, /init\.signal\?\.addEventListener\('abort', callerAbort/, 'çağıran iptali korunmalı');
assert.match(kaynak, /init\.signal\?\.removeEventListener\('abort', callerAbort/, 'iptal dinleyicisi temizlenmeli');
assert.match(kaynak, /finally\s*\{[^]*clearTimeout\(/, 'timer finally içinde temizlenmeli');
assert.match(kaynak, /AbortError[^]*network_timeout/, 'AbortError network_timeout olarak eşlenmeli');

console.log('✓ Paylaşılan API istemcisinde 30 saniyelik timeout var.');
