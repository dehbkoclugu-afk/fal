# Telve Design Wave 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete roadmap items 41–80 by replacing context-free art selection with a validated semantic art registry and upgrading the natal reveal, focus selection, chart interaction, and sharing surfaces.

**Architecture:** Keep all art local and Metro-static through literal `require()` calls. Screens resolve art through a typed semantic registry, while pure natal layout helpers produce deterministic glyph and aspect geometry consumed by the existing React Native SVG wheel. Existing Node contract scripts provide CI coverage without adding a test framework or runtime dependency.

**Tech Stack:** Expo 57, React Native 0.86, TypeScript 5.8, React Native SVG 15, React Native Reanimated 4, React Native View Shot 5, Node.js contract scripts, local WebP assets.

## Global Constraints

- Implement every item 41–80 in `fal-mobile/docs/DESIGN-ROADMAP-100.md`.
- Use one branch and one final PR, with bitmap assets and UI changes in separate commit checkpoints.
- Add no runtime dependency.
- Ship at least 24 semantic art identities and 48 dark/light WebP files.
- Card art uses 3:2, hero art uses 16:9, and share art uses 4:5.
- Card/hero WebP files are at most 300 KB; share WebP files are at most 500 KB.
- Coffee art must never resolve on tarot, dream, or natal surfaces.
- Every interactive target added or changed is at least 44×44 dp.
- Backend remains the only source of natal calculations and server prices.
- Unknown birth time must label the Ascendant as an estimate.
- Sharing must omit exact birth time and location by default.
- Preserve existing CI, security, i18n, web export, and Android preview workflows.

---

## File Structure

**Create**

- `fal-mobile/lib/natalLayout.ts` — pure deterministic glyph collision and aspect-density helpers.
- `fal-mobile/components/NatalRevealCard.tsx` — one accessible Sun/Moon/Ascendant reveal card.
- `fal-mobile/components/NatalShareCard.tsx` — dedicated 4:5 high-resolution natal share renderer.
- `fal-mobile/scripts/natal-state-check.mjs` — contract checks for layout, reveal, focus, accessibility, and sharing.
- `fal-mobile/assets/art/<semantic-id>-<dark|light>.webp` — semantic bitmap set.

**Modify**

- `fal-mobile/lib/artAssets.ts` — typed semantic metadata, literal requires, safe resolution.
- `fal-mobile/components/ArtSlot.tsx` — semantic placement and selected/strength veil behavior.
- `fal-mobile/scripts/art-check.mjs` — pair, registry, ratio, size, and surface checks.
- `fal-mobile/docs/ART-SYSTEM.md` — identity, palette, ratio, budget, and usage rules.
- `fal-mobile/app/onboarding/reveal.tsx` — semantic reveal cards, estimate state, reduced motion.
- `fal-mobile/app/ritual/natal.tsx` — semantic topic cards and price/balance/entitlement context.
- `fal-mobile/components/NatalChartWheel.tsx` — layer model, deterministic collision layout, responsive density, accessible chips.
- `fal-mobile/components/ShareCard.tsx` — delegate natal sharing to dedicated renderer.
- `fal-mobile/lib/i18n/tr.ts` — new Turkish labels and accessibility copy.
- `fal-mobile/package.json` — include natal contract in `ci:check`.

---

### Task 1: Typed Semantic Art Registry and CI Contract

**Files:**
- Modify: `fal-mobile/lib/artAssets.ts`
- Modify: `fal-mobile/components/ArtSlot.tsx`
- Modify: `fal-mobile/scripts/art-check.mjs`
- Modify: `fal-mobile/package.json`
- Test: `fal-mobile/scripts/art-check.mjs`

**Interfaces:**
- Produces: `ArtGroup`, `ArtRatio`, `ArtSurface`, `SemanticArt`, `artwork`, `resolveArt(group, key, surface)`.
- Consumes: React Native `ImageSourcePropType`, existing `ArtSlot` callers.

- [ ] **Step 1: Replace the hard-coded ID list in the contract with semantic manifest parsing**

Add manifest markers to `artAssets.ts` and make `art-check.mjs` extract every `id`, dark/light path, ratio, max byte budget, and allowed surface. The failing assertions must include:

```js
assert(ids.length >= 24, 'En az 24 semantik art kimliği gerekli');
assert(ids.every((id) => variants(id).sort().join(',') === 'dark,light'));
assert(!resolveMarker('ritual', 'natal', 'natal-card').includes('coffee'));
assert(!resolveMarker('ritual', 'tarot', 'tarot-card').includes('coffee'));
assert(!resolveMarker('ritual', 'dream', 'dream-card').includes('coffee'));
```

- [ ] **Step 2: Run the existing art check and verify it fails**

Run:

```bash
cd fal-mobile
npm run art:check
```

Expected: FAIL because the semantic manifest and 24 identities do not exist.

- [ ] **Step 3: Implement the typed registry with literal Metro requires**

Use these public types and resolver signature:

```ts
export type ArtGroup = 'ritual' | 'topic' | 'state' | 'editorial';
export type ArtRatio = 'card' | 'hero' | 'share';
export type ArtSurface =
  | 'coffee-card' | 'tarot-card' | 'dream-card' | 'natal-card'
  | 'natal-topic' | 'natal-reveal' | 'paywall'
  | 'daily' | 'history' | 'ledger' | 'share';

export type SemanticArt = Readonly<{
  id: ArtId;
  group: ArtGroup;
  ratio: ArtRatio;
  safeSide: 'left' | 'right';
  maxBytes: 300000 | 500000;
  surfaces: readonly ArtSurface[];
  dark: ImageSourcePropType;
  light: ImageSourcePropType;
}>;

export function resolveArt(
  group: ArtGroup,
  key: string,
  surface: ArtSurface,
): SemanticArt;
```

The resolver first matches group + key + allowed surface, then uses the same group’s `general` identity. It must throw during development when neither exists. Never fall back across groups.

- [ ] **Step 4: Update `ArtSlot` to consume metadata without changing existing callers all at once**

Keep `id` support and add `art`, `selected`, and `contentSide`:

```ts
type ArtSlotProps = {
  id?: ArtId;
  art?: SemanticArt;
  strength?: 'soft' | 'card' | 'strong';
  selected?: boolean;
  contentSide?: 'left' | 'right';
};
```

Require exactly one of `id` or `art` at runtime in development. Selected topic cards use a lower veil alpha plus a visible non-color border supplied by the parent card.

- [ ] **Step 5: Extend `art-check.mjs`**

For each registry entry:

1. verify both literal files exist;
2. parse WebP dimensions from the RIFF/VP8X header using Node `Buffer`;
3. enforce 3:2, 16:9, or 4:5 within 1% tolerance;
4. enforce `maxBytes`;
5. verify every file in `assets/art` is registered;
6. verify forbidden coffee surface combinations are absent.

Do not add an image parser dependency.

- [ ] **Step 6: Run the focused contract**

Run:

```bash
cd fal-mobile
npm run art:check
npm run typecheck
```

Expected: art check still FAILS only for missing new bitmap files; typecheck PASS after caller compatibility is preserved.

- [ ] **Step 7: Commit the registry checkpoint**

```bash
git add fal-mobile/lib/artAssets.ts fal-mobile/components/ArtSlot.tsx fal-mobile/scripts/art-check.mjs fal-mobile/package.json
git commit -m "feat: add semantic art registry contract"
```

---

### Task 2: Generate and Install the 48-File Semantic Art Set

**Files:**
- Create: `fal-mobile/assets/art/*.webp`
- Modify: `fal-mobile/lib/artAssets.ts`
- Modify: `fal-mobile/docs/ART-SYSTEM.md`
- Test: `fal-mobile/scripts/art-check.mjs`

**Interfaces:**
- Consumes: Task 1 `SemanticArt` registry.
- Produces: at least 24 complete identities with literal dark/light source pairs.

- [ ] **Step 1: Fix the identity inventory before generation**

Use these 24 stable identities:

```text
ritual: coffee-cup, coffee-grounds, coffee-saucer,
        tarot-deck, tarot-spread, tarot-candle,
        dream-moon, dream-window, dream-water,
        natal-wheel, natal-planets, natal-aspects
topic:  love, money, career, self, general
state:  free, premium, loading, failed
editorial: daily, history, ledger, share
```

Because this list has 25 identities, keep all 25 rather than deleting one; the roadmap requires a minimum, not an exact count.

- [ ] **Step 2: Generate one dark master and derive a separately composed light partner per identity**

Use this common visual brief for every asset, changing only the semantic subject:

```text
Telve mobile app editorial still life, cinematic but restrained, oxidized copper,
porcelain cream, deep night blue and espresso-brown palette, no people, no hands,
no face, no text, no logo, no trademark, no neon galaxy gradient. Main subject on
the right with calm negative space on the left. Subject must remain recognizable
at 160x100. Produce an original composition, not an imitation of a living artist.
```

Generate the correct master ratio from registry metadata. Light variants are separately lit compositions, not brightness-filtered dark copies.

- [ ] **Step 3: Convert generated sources to WebP within budget**

Use the installed image tooling without adding a package:

```bash
cwebp -quiet -q 82 input.png -o fal-mobile/assets/art/<id>-dark.webp
cwebp -quiet -q 82 input-light.png -o fal-mobile/assets/art/<id>-light.webp
```

If `cwebp` is unavailable, use the already-installed ImageMagick formatter:

```bash
magick input.png -quality 82 fal-mobile/assets/art/<id>-dark.webp
```

Reduce quality only until the registry budget passes; do not change ratios.

- [ ] **Step 4: Register every literal require**

Each identity must have explicit sources:

```ts
'natal-wheel': {
  id: 'natal-wheel',
  group: 'ritual',
  ratio: 'card',
  safeSide: 'left',
  maxBytes: 300000,
  surfaces: ['natal-card', 'natal-reveal'],
  dark: require('../assets/art/natal-wheel-dark.webp'),
  light: require('../assets/art/natal-wheel-light.webp'),
},
```

- [ ] **Step 5: Document the art system**

Update `ART-SYSTEM.md` with the exact 25 identities, ratios, byte budgets, palette, safe-area rule, forbidden content, and the rule that coffee art cannot appear on natal/tarot/dream surfaces.

- [ ] **Step 6: Run visual and mechanical acceptance**

Run:

```bash
cd fal-mobile
npm run art:check
npm run typecheck
```

Additionally render or thumbnail every file to 160×100 and visually reject any asset whose intended subject is not recognizable or whose primary subject overlaps the configured safe side.

Expected: PASS with at least 25 identities / 50 variants.

- [ ] **Step 7: Commit bitmap assets separately**

```bash
git add fal-mobile/assets/art fal-mobile/lib/artAssets.ts fal-mobile/docs/ART-SYSTEM.md
git commit -m "feat: add Telve semantic art set"
```

---

### Task 3: Upgrade Onboarding Natal Reveal

**Files:**
- Create: `fal-mobile/components/NatalRevealCard.tsx`
- Modify: `fal-mobile/app/onboarding/reveal.tsx`
- Modify: `fal-mobile/lib/i18n/tr.ts`
- Create: `fal-mobile/scripts/natal-state-check.mjs`
- Modify: `fal-mobile/package.json`
- Test: `fal-mobile/scripts/natal-state-check.mjs`

**Interfaces:**
- Consumes: `resolveArt('ritual', 'natal-*', 'natal-reveal')`, existing `Teaser`, existing `NatalChart`.
- Produces: `NatalRevealCard` and static contracts for known/unknown birth time.

- [ ] **Step 1: Write a failing reveal contract**

The script must verify:

```js
for (const marker of [
  '<NatalRevealCard',
  "kind="ascendant"",
  "kind="sun"",
  "kind="moon"",
  "estimated={!draft.timeKnown}",
  'useReducedMotion',
]) assert.ok(reveal.includes(marker), `Reveal sözleşmesi eksik: ${marker}`);
```

It must also reject `ritualArt.coffee`, `coffee-dark.webp`, and `kind="coffee"` in reveal and natal files.

- [ ] **Step 2: Run the contract and verify failure**

Run:

```bash
cd fal-mobile
node scripts/natal-state-check.mjs
```

Expected: FAIL because `NatalRevealCard` and reduced-motion handling do not exist.

- [ ] **Step 3: Implement `NatalRevealCard`**

Public interface:

```ts
type NatalRevealKind = 'ascendant' | 'sun' | 'moon';

type NatalRevealCardProps = {
  kind: NatalRevealKind;
  label: string;
  value: string;
  degree?: number;
  note: string;
  estimated?: boolean;
};
```

The component resolves a natal semantic mini art, shows glyph + value + degree + one paragraph, and exposes one accessibility label. `estimated` adds both a visible outlined badge and accessibility text; it cannot rely on color.

- [ ] **Step 4: Replace reveal rows**

Render three cards. The Ascendant card receives `estimated={!draft.timeKnown}`. Sun and Moon never receive the estimate state. Continue using the current API response; do not calculate signs locally.

- [ ] **Step 5: Align loading and result wheels**

Keep the center label inside the disk and use the same natal-wheel art/colors as the final chart. Read `useReducedMotion()`; when true, disable breathing and staggered entrance movement while preserving immediate opacity changes.

- [ ] **Step 6: Add Turkish copy**

Add explicit keys for estimated Ascendant, known/unknown data confidence, and accessibility labels. Keep existing copy keys intact for backward compatibility.

- [ ] **Step 7: Run focused and global checks**

Run:

```bash
cd fal-mobile
node scripts/natal-state-check.mjs
npm run i18n:check
npm run typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit reveal checkpoint**

```bash
git add fal-mobile/components/NatalRevealCard.tsx fal-mobile/app/onboarding/reveal.tsx fal-mobile/lib/i18n/tr.ts fal-mobile/scripts/natal-state-check.mjs fal-mobile/package.json
git commit -m "feat: improve natal reveal experience"
```

---

### Task 4: Add Semantic Natal Focus Cards and Purchase Context

**Files:**
- Modify: `fal-mobile/app/ritual/natal.tsx`
- Modify: `fal-mobile/lib/i18n/tr.ts`
- Modify: `fal-mobile/scripts/natal-state-check.mjs`
- Test: `fal-mobile/scripts/natal-state-check.mjs`

**Interfaces:**
- Consumes: Task 1 `resolveArt('topic', key, 'natal-topic')`, existing `api.me()`, `CoinGate`.
- Produces: accessible five-topic focus selector and `NatalPurchaseContext` UI block.

- [ ] **Step 1: Add failing focus and pricing assertions**

Require all server keys and topic keys to remain paired:

```js
const focusPairs = [
  ['genel', 'general'], ['ask', 'love'], ['para', 'money'],
  ['kariyer', 'career'], ['kendim', 'self'],
];
for (const [server, art] of focusPairs) {
  assert.ok(natal.includes(`key: '${server}'`));
  assert.ok(natal.includes(`art: '${art}'`));
}
for (const marker of [
  'accessibilityRole="radio"',
  'accessibilityState={{ selected: on }}',
  'minHeight: 44',
  'styles.purchaseContext',
]) assert.ok(natal.includes(marker));
```

- [ ] **Step 2: Run the contract and verify failure**

Run `node fal-mobile/scripts/natal-state-check.mjs`.

Expected: FAIL on missing art mapping, radio semantics, or purchase context.

- [ ] **Step 3: Extend `ODAKLAR` without changing server values**

Add an `art` property only:

```ts
{ key: 'genel', art: 'general', title: 'natal.butunHarita', note: 'natal.butunHaritaNot', glyph: '◎' }
```

Keep `genel|ask|para|kariyer|kendim` sent to the backend unchanged.

- [ ] **Step 4: Render semantic topic cards**

Each card uses `ArtSlot` with the topic art. Selected state combines brighter veil, border, check shape, `accessibilityRole="radio"`, and `accessibilityState={{ selected: on }}`. Set `minHeight: 44` and preserve two-line notes.

- [ ] **Step 5: Add purchase context immediately above CTA**

Show:

- current coin balance;
- server-derived natal price;
- premium entitlement status.

Use `me.prices.natal` and `me.entitlement`; do not add another price constant. Keep `CoinGate` for insufficient balance.

- [ ] **Step 6: Run checks**

Run:

```bash
cd fal-mobile
node scripts/natal-state-check.mjs
npm run i18n:check
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit focus checkpoint**

```bash
git add fal-mobile/app/ritual/natal.tsx fal-mobile/lib/i18n/tr.ts fal-mobile/scripts/natal-state-check.mjs
git commit -m "feat: add semantic natal focus cards"
```

---

### Task 5: Make the Natal Chart Layout Deterministic and Accessible

**Files:**
- Create: `fal-mobile/lib/natalLayout.ts`
- Modify: `fal-mobile/components/NatalChartWheel.tsx`
- Modify: `fal-mobile/lib/i18n/tr.ts`
- Modify: `fal-mobile/scripts/natal-state-check.mjs`
- Test: `fal-mobile/scripts/natal-state-check.mjs`

**Interfaces:**
- Consumes: existing `NatalChartBody`, aspect `strength`, screen width.
- Produces:
  - `layoutBodies(bodies, minimumGapDeg): PositionedBody[]`
  - `visibleAspects(aspects, width): NatalAspect[]`
  - accessible responsive `NatalChartWheel`.

- [ ] **Step 1: Write failing pure-layout assertions**

Compile `natalLayout.ts` with the existing TypeScript/vm pattern and assert:

```js
const placed = layoutBodies([
  { key: 'sun', lon: 10 },
  { key: 'moon', lon: 11 },
  { key: 'venus', lon: 12 },
], 8);
assert.deepEqual(placed.map((x) => x.lane), [0, 1, 2]);
assert.deepEqual(layoutBodies(input, 8), layoutBodies(input, 8));
assert.ok(visibleAspects(aspects, 320).length < visibleAspects(aspects, 700).length);
```

- [ ] **Step 2: Run the contract and verify failure**

Run `node fal-mobile/scripts/natal-state-check.mjs`.

Expected: FAIL because `natalLayout.ts` does not exist.

- [ ] **Step 3: Implement the minimum pure helpers**

Use stable longitude/key sorting. Assign the first available radial lane whose last longitude is at least `minimumGapDeg` away, capped at three lanes. Preserve true longitude on every result; only `displayRadius` changes.

Sort aspects by strength descending and return width-based caps:

```ts
const cap = width < 360 ? 8 : width < 600 ? 12 : 18;
```

- [ ] **Step 4: Split wheel rendering into explicit layers**

Within the existing SVG, keep four ordered groups:

```tsx
<G accessibilityLabel={t('harita.katmanBurclar')}>{/* zodiac */}</G>
<G accessibilityLabel={t('harita.katmanEvler')}>{/* houses */}</G>
<G accessibilityLabel={t('harita.katmanAcilar')}>{/* aspects */}</G>
<G accessibilityLabel={t('harita.katmanGezegenler')}>{/* bodies */}</G>
```

Hard aspects remain `color.kiremit`; harmonious aspects remain `color.cini`. Use `visibleAspects` for density.

- [ ] **Step 5: Synchronize selection**

Use `layoutBodies` for SVG glyph positions. A selected planet receives a non-color circle/outline in the wheel and selected styling in its chip/detail panel. The detail remains based on true degree and house.

- [ ] **Step 6: Make chips responsive and 44×44 dp**

Use percentage/flex basis appropriate to width, `minHeight: 44`, and labels containing name, sign, degree, and selection state. Move “SWISS EPHEMERIS/MOSHIER” out of the header into a collapsed help note under the details.

- [ ] **Step 7: Run contract, type, and web checks**

Run:

```bash
cd fal-mobile
node scripts/natal-state-check.mjs
npm run typecheck
npm run build:web
```

Expected: PASS and 22 static routes exported.

- [ ] **Step 8: Commit chart checkpoint**

```bash
git add fal-mobile/lib/natalLayout.ts fal-mobile/components/NatalChartWheel.tsx fal-mobile/lib/i18n/tr.ts fal-mobile/scripts/natal-state-check.mjs
git commit -m "feat: improve natal chart interaction"
```

---

### Task 6: Add Dedicated High-Resolution Natal Sharing

**Files:**
- Create: `fal-mobile/components/NatalShareCard.tsx`
- Modify: `fal-mobile/components/ShareCard.tsx`
- Modify: `fal-mobile/lib/i18n/tr.ts`
- Modify: `fal-mobile/scripts/natal-state-check.mjs`
- Test: `fal-mobile/scripts/natal-state-check.mjs`

**Interfaces:**
- Consumes: existing verified `NatalChart`, optional selected body key, safe summary.
- Produces: `NatalShareCard({ chart, summary, selectedBodyKey? })`, 4:5 capture, retryable error state.

- [ ] **Step 1: Add failing privacy and ratio checks**

Require:

```js
for (const marker of [
  'aspectRatio: 4 / 5',
  'NatalChartWheel chart={chart} compact',
  'selectedBodyKey',
  'captureRef',
]) assert.ok(natalShare.includes(marker));
for (const forbidden of ['birthTime', 'birth_time', 'placeName', 'place_name', 'lat', 'lon']) {
  assert.ok(!natalShare.includes(forbidden), `Paylaşım kişisel alan içeriyor: ${forbidden}`);
}
```

- [ ] **Step 2: Run the contract and verify failure**

Run `node fal-mobile/scripts/natal-state-check.mjs`.

Expected: FAIL because the component is absent.

- [ ] **Step 3: Implement `NatalShareCard`**

Interface:

```ts
type NatalShareCardProps = {
  chart: NatalChart;
  summary: string;
  selectedBodyKey?: string;
};
```

Render a dedicated 4:5 surface with semantic share/natal art, compact wheel, safe summary, basic three, Telve brand, and entertainment disclaimer. Do not accept birth time, place, latitude, or longitude props.

Use `captureRef` with explicit output dimensions suitable for 1080×1350. Keep error state in the component and allow the share button to retry.

- [ ] **Step 4: Delegate natal paths from `ShareCard`**

When complete chart data is available for `kind === 'natal'`, render `NatalShareCard`; preserve the current generic card for every other ritual. Do not break existing `ShareCard` props—add optional `natalChart` and `selectedBodyKey`.

- [ ] **Step 5: Run focused checks**

Run:

```bash
cd fal-mobile
node scripts/natal-state-check.mjs
npm run typecheck
npm run i18n:check
```

Expected: PASS.

- [ ] **Step 6: Commit sharing checkpoint**

```bash
git add fal-mobile/components/NatalShareCard.tsx fal-mobile/components/ShareCard.tsx fal-mobile/lib/i18n/tr.ts fal-mobile/scripts/natal-state-check.mjs
git commit -m "feat: add high-resolution natal sharing"
```

---

### Task 7: Complete the Snapshot Matrix and Release Verification

**Files:**
- Modify: `fal-mobile/scripts/natal-state-check.mjs`
- Modify: `fal-mobile/package.json`
- Modify: `fal-mobile/docs/DESIGN-ROADMAP-100.md`
- Test: all mobile contract scripts and GitHub workflows.

**Interfaces:**
- Consumes: Tasks 1–6.
- Produces: CI-enforced Dalga 2 acceptance and a preview APK.

- [ ] **Step 1: Encode the matrix in the contract script**

Add table-driven checks for:

```js
const matrix = {
  birthTime: ['known', 'unknown'],
  viewport: ['small-android', 'large-android', 'tablet'],
  fontScale: ['normal', 'large'],
  theme: ['dark', 'light'],
  selection: ['none', 'planet'],
  motion: ['normal', 'reduced'],
  state: ['loading', 'ready', 'missing-data', 'share-error'],
};
assert.equal(Object.values(matrix).reduce((n, values) => n * values.length, 1), 384);
```

The contract need not render 384 bitmap files. It must verify that pure layout/state functions and component branches cover each dimension, while three representative rendered screenshots cover small Android, large Android, and tablet.

- [ ] **Step 2: Add `natal-state:check` to CI**

```json
"natal-state:check": "node scripts/natal-state-check.mjs"
```

Place it inside `ci:check` after `art:check`.

- [ ] **Step 3: Mark roadmap items only after checks pass**

Change items 41–80 to checked Markdown items or add a completion table referencing the exact commit checkpoints and commands. Do not claim real-device validation before it occurs.

- [ ] **Step 4: Run the full local verification**

Run:

```bash
cd fal-mobile
npm run ci:check
npm run security:check
npm run build:web
cd ../fal-backend
python -m compileall -q app tests
```

Expected:

- all mobile contracts PASS;
- security check PASS with only existing scoped waivers;
- 22 web routes export;
- Python compileall PASS.

- [ ] **Step 5: Push and open one PR**

Push `agent/design-wave-2` and open a PR targeting `main`. The PR body must map tasks to roadmap items 41–80, list every verification command, and state that bitmap and UI changes are separate commits.

- [ ] **Step 6: Verify GitHub CI and Android Preview APK**

Wait for both workflows. If CI fails, inspect the failing job before changing code. If Android Preview succeeds, record artifact ID, SHA-256 digest, expiry, and head SHA in the PR.

- [ ] **Step 7: Commit final acceptance metadata**

```bash
git add fal-mobile/scripts/natal-state-check.mjs fal-mobile/package.json fal-mobile/docs/DESIGN-ROADMAP-100.md
git commit -m "test: enforce design wave 2 acceptance"
```

The PR is ready when CI and Android Preview APK both succeed and every roadmap item 41–80 has an evidence link.
