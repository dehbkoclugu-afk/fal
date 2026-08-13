# Telve Release Hardening Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox syntax.

**Goal:** Production Android build'ini canlı API ve RevenueCat'e güvenli yapılandırma ile bağlamak ve sonsuz ağ beklemelerini önlemek.

**Architecture:** Expo configuration public build variables from the build environment and exposes only publishable client values through `extra`. The shared API client owns one request timeout and normalized timeout error, so every screen inherits the same behavior without per-screen guards. Existing FastAPI, RQ, RevenueCat, and UI flows remain unchanged.

**Tech Stack:** Expo SDK 57, React Native 0.86, TypeScript 5.8, Node.js 22, FastAPI, pytest

## Global Constraints

- Never commit RevenueCat keys, EAS project IDs, backend secrets, or production credentials.
- Keep AppLovin and PostHog disabled for the first release.
- Add no new dependency; use `AbortController`, Node standard library, and existing checks.
- Base all work on `main`; do not branch from the stale default branch.

---

### Task 1: Make Expo production configuration environment-driven

**Files:**
- Create: `fal-mobile/app.config.ts`
- Modify: `fal-mobile/app.json`
- Create: `fal-mobile/scripts/config-check.mjs`
- Modify: `fal-mobile/package.json`

**Interfaces:**
- Consumes: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_RC_ANDROID_KEY`, `EAS_PROJECT_ID`
- Produces: Expo `extra.apiUrl`, `extra.rcAndroidKey`, `extra.eas.projectId`

- [ ] **Step 1: Write the failing configuration check**

  Create `fal-mobile/scripts/config-check.mjs` using only `node:child_process` and `node:assert/strict`. Run `npx expo config --type public --json`, parse it, and assert that supplied sentinel environment values appear at `expo.extra.apiUrl`, `expo.extra.rcAndroidKey`, and `expo.extra.eas.projectId`; assert that `posthogKey`, `maxSdkKey`, and rewarded-unit values remain `null`.

- [ ] **Step 2: Expose the check through npm and verify failure**

  Add `"config:check": "node scripts/config-check.mjs"` to `scripts` and append it to `ci:check`. Run `npm run config:check`; expect failure because `app.config.ts` does not exist and sentinel values are not applied.

- [ ] **Step 3: Remove deploy-specific values from static JSON**

  Keep public defaults and native plugin declarations in `app.json`, but leave `extra.rcAndroidKey` and `extra.eas.projectId` null. Do not put any real identifier in the file.

- [ ] **Step 4: Add the minimum Expo config adapter**

  Create `app.config.ts` that imports the JSON config and returns it with:

  ```ts
  const { expo } = require('./app.json');

  export default {
    ...expo,
    extra: {
      ...expo.extra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL ?? expo.extra.apiUrl,
      rcAndroidKey: process.env.EXPO_PUBLIC_RC_ANDROID_KEY ?? null,
      eas: {
        ...expo.extra.eas,
        projectId: process.env.EAS_PROJECT_ID ?? null,
      },
    },
  };
  ```

- [ ] **Step 5: Run configuration verification**

  Run `npm run config:check && npm run typecheck`; expect both to exit 0 and the sentinel values to be visible only in generated config output.

- [ ] **Step 6: Commit**

  Commit the four files with `build: read Android release config from environment`.

### Task 2: Add one shared API timeout

**Files:**
- Modify: `fal-mobile/lib/api.ts`
- Create: `fal-mobile/scripts/api-check.mjs`
- Modify: `fal-mobile/package.json`
- Modify: `fal-mobile/lib/i18n/tr.ts`

**Interfaces:**
- Consumes: all existing `api.*` calls through `request<T>(path, init)`
- Produces: `ApiError(0, "network_timeout", localizedMessage)` after 30 seconds

- [ ] **Step 1: Write the failing source contract check**

  Create `scripts/api-check.mjs` that reads `lib/api.ts` and asserts the shared request function contains `AbortController`, a 30,000 ms timer, passes `signal` to `fetch`, clears the timer in `finally`, and maps `AbortError` to `network_timeout`. This source-level check matches the project's existing `bildirim-check` and `yetenek-check` pattern without adding a test runner.

- [ ] **Step 2: Add the check and verify failure**

  Add `"api:check": "node scripts/api-check.mjs"` and include it in `ci:check`. Run `npm run api:check`; expect a non-zero exit stating that the shared timeout is absent.

- [ ] **Step 3: Add localized timeout copy**

  Add the `network_timeout` error key to the existing Turkish error catalog in `lib/i18n/tr.ts` with a retryable message; do not add screen-specific copy.

- [ ] **Step 4: Implement the timeout in `request`**

  Create one controller per request, schedule `controller.abort()` at 30 seconds, pass `signal: init.signal ?? controller.signal`, catch `AbortError` and throw `new ApiError(0, 'network_timeout', hataMetni('network_timeout'))`, and clear the timer in `finally`. Preserve caller-supplied signals.

- [ ] **Step 5: Verify every consumer receives the change**

  Run `npm run api:check && npm run typecheck && npm run i18n:check`; expect all to pass. Use `rg "fetch\\(" fal-mobile` and confirm application API calls still route through `lib/api.ts`; documented third-party/internal fetches may remain separate.

- [ ] **Step 6: Commit**

  Commit with `fix: bound mobile API requests`.

### Task 3: Lock first-release feature state

**Files:**
- Modify: `fal-mobile/scripts/yetenek-check.mjs`
- Modify: `fal-mobile/scripts/config-check.mjs`
- Test: `fal-mobile/package.json`

**Interfaces:**
- Consumes: resolved Expo config
- Produces: release failure when RevenueCat is absent or ads/analytics are accidentally enabled

- [ ] **Step 1: Add a release-mode failing check**

  Extend `config-check.mjs` with `--release`. In release mode require HTTPS `extra.apiUrl`, non-empty `extra.rcAndroidKey`, non-empty `extra.eas.projectId`, and null AppLovin/PostHog keys. Keep the default sentinel self-test for CI so CI needs no secrets.

- [ ] **Step 2: Verify expected failure without secrets**

  Run `node scripts/config-check.mjs --release`; expect explicit failures for RevenueCat and EAS project ID, not a stack trace or secret value.

- [ ] **Step 3: Add the production gate**

  Add `"config:release": "node scripts/config-check.mjs --release"` and put it at the start of `release:check`. Update `yetenek-check.mjs` output to state that AppLovin and PostHog being closed is intentional for v1; do not make their absence fail.

- [ ] **Step 4: Verify with temporary sentinel environment values**

  Run:

  ```bash
  EXPO_PUBLIC_API_URL=https://api.telve.app \
  EXPO_PUBLIC_RC_ANDROID_KEY=goog_test_public_key \
  EAS_PROJECT_ID=00000000-0000-0000-0000-000000000000 \
  npm run config:release
  ```

  Expect exit 0. Then run without the three variables and expect exit 1.

- [ ] **Step 5: Commit**

  Commit with `build: enforce first-release capabilities`.

### Task 4: Re-run the full automated release suite

**Files:**
- Test: `fal-mobile/**`
- Test: `fal-backend/tests/**`

**Interfaces:**
- Consumes: release environment variables and existing services
- Produces: recorded green verification output

- [ ] **Step 1: Run backend tests with PostgreSQL and Redis**

  From `fal-backend`, run `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fal_test REDIS_URL=redis://localhost:6379/0 python -m pytest`; expect all tests to pass.

- [ ] **Step 2: Run mobile CI checks**

  From `fal-mobile`, run `npm ci && npm run ci:check && npm run security:check && EXPO_OFFLINE=1 npx expo-doctor`; expect checks to pass and Expo Doctor to report 20/20.

- [ ] **Step 3: Run the release gate with real configured environment**

  Run `npm run release:check` with production API, RevenueCat public key, and EAS project ID supplied by the build environment. Expect legal placeholders to be the only possible remaining failure before the legal task is completed.

- [ ] **Step 4: Commit only if verification required a scoped fix**

  If no fix was needed, create no empty commit. If a release-blocking fix was needed, repeat the failing check first and commit only that fix with `fix: clear release verification blocker`.
