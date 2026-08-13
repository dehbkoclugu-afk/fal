# Telve Google Play Release Implementation Plan

> **For agentic workers:** Execute this plan task-by-task. Steps use checkbox syntax.

**Goal:** Configure billing and legal/store assets, validate the Play-distributed Android build, and promote only a release that passes every launch gate.

**Architecture:** Google Play owns products, signing, test distribution, and store declarations; RevenueCat maps Play products to the existing backend entitlement IDs. The release checklist records evidence from GitHub Actions, production services, Play test orders, and physical-device tests. Manual console actions remain a runbook rather than custom automation.

**Tech Stack:** Google Play Console, RevenueCat, Expo/EAS, Android App Bundle, GitHub Actions

## Global Constraints

- Use `com.telve.app`; changing package name creates a different Play application.
- Use only `star`, `fate`, and `yearly` entitlement IDs.
- Do not enable AppLovin or PostHog in v1.
- Never test billing with a personal production charge when Play license testing is available.
- Do not promote with a red gate, even if the app appears usable.

---

### Task 1: Create the release checklist

**Files:**
- Create: `fal-mobile/docs/release-checklist.md`
- Modify: `fal-mobile/docs/play-store.md`

**Interfaces:**
- Consumes: design success criteria
- Produces: one evidence table with owner, status, evidence link, and checked date

- [ ] **Step 1: Add checklist sections**

  Include source/CI, physical device, backend, billing, legal, store assets, Data Safety, AAB, pre-launch report, and promotion decision. Use unchecked boxes and exact expected evidence for each item.

- [ ] **Step 2: Correct stale Play documentation**

  Update `play-store.md` statements that say RevenueCat, PostHog, and AppLovin are all currently closed: v1 requires RevenueCat open while PostHog/AppLovin remain closed. Preserve the conditional Data Safety distinctions.

- [ ] **Step 3: Verify documentation consistency**

  Run `rg -n "RevenueCat.*kapalı|üçü de.*KAPALI|reklam.*açık" fal-mobile/docs fal-mobile/public` and resolve contradictions against the approved v1 scope.

- [ ] **Step 4: Commit**

  Commit with `docs: add Play release evidence checklist`.

### Task 2: Complete legal content

**Files:**
- Modify: `fal-mobile/public/gizlilik.html`
- Modify: `fal-mobile/public/privacy.html`
- Modify: `fal-mobile/public/kosullar.html`
- Modify: `fal-mobile/public/veri-silme.html`

**Interfaces:**
- Consumes: legal name, service address, support email, KVKK email, effective date
- Produces: public legal pages with no `[[UPPER_CASE]]` placeholders

- [ ] **Step 1: Collect the five owner values**

  Obtain the exact legal entity/name, serviceable address, support email, KVKK email, and `GG.AA.YYYY` effective date from the app owner. Stop this task if any value is unknown; do not invent legal identity data.

- [ ] **Step 2: Replace placeholders consistently**

  Replace each matching token in all HTML files with the same approved value. Preserve HTML escaping for address punctuation and Turkish characters.

- [ ] **Step 3: Run legal and release checks**

  Run `npm run yasal:check`, then the configured `npm run release:check`; expect no placeholder, broken-link, build, security, or capability failures.

- [ ] **Step 4: Publish and probe URLs**

  Deploy `dist-web` to `telve.app`, then run `curl --fail --location` for `/gizlilik.html`, `/privacy.html`, `/kosullar.html`, and `/veri-silme.html`; expect HTTPS 200 and correct page titles.

- [ ] **Step 5: Commit**

  Commit with `legal: finalize Telve launch pages` only after the owner confirms the exact values.

### Task 3: Configure Play products and RevenueCat

**Files:**
- External: Google Play Console products
- External: RevenueCat project, app, entitlements, offering, webhook
- Test: `fal-backend/tests/test_api.py`

**Interfaces:**
- Consumes: Play subscription product IDs and package `com.telve.app`
- Produces: current RevenueCat offering mapped to `star`, `fate`, `yearly`

- [ ] **Step 1: Create Play subscriptions**

  Create monthly Star, monthly Fate, and yearly plans with unique stable product IDs; activate base plans and add Turkish title, description, and prices.

- [ ] **Step 2: Create exact RevenueCat entitlements**

  Create `star`, `fate`, and `yearly`; attach each Play product to the matching entitlement. Do not use display names as IDs.

- [ ] **Step 3: Create the current offering**

  Attach all three packages to one current offering and verify the SDK's `offerings.current.availablePackages` returns them, matching `fal-mobile/lib/purchases.ts`.

- [ ] **Step 4: Configure identities and webhook**

  Use the mobile `anon_id` as RevenueCat App User ID, set the webhook URL to `https://api.telve.app/v1/webhooks/revenuecat`, and set `Authorization: Bearer <RC_WEBHOOK_SECRET>` without recording the secret in the repo.

- [ ] **Step 5: Re-run webhook tests**

  From `fal-backend`, run `python -m pytest tests/test_api.py -k revenuecat`; expect signature rejection, missing-secret rejection, known entitlement mapping, and unknown-entitlement fallback tests to pass.

- [ ] **Step 6: Test Play billing**

  Add a Gmail account as Play license tester and internal tester. Through the Play-distributed build, purchase Star, verify `/v1/me` shows `star` and quota 10, reinstall, restore, then test Fate or Yearly and verify unlimited quota.

- [ ] **Step 7: Test lifecycle events**

  Use Play's accelerated test renewal/expiration. Verify cancellation sets `will_renew=false`, entitlement remains until expiration, and `/v1/me` returns no active entitlement after expiration time.

### Task 4: Perform physical-device acceptance

**Files:**
- Modify: `fal-mobile/docs/release-checklist.md`

**Interfaces:**
- Consumes: Play internal-testing build and production backend
- Produces: dated pass/fail evidence for the real-device matrix

- [ ] **Step 1: Install from Play**

  Remove any sideloaded build, join internal testing, and install from the Play Store so signing, split delivery, and billing match production.

- [ ] **Step 2: Run anonymous onboarding**

  Complete name, birth, place, reveal, preferences, notification choice, and paywall; verify the initial five coins appear and app restart preserves identity.

- [ ] **Step 3: Run every ritual**

  Complete coffee with a real photo, tarot, natal, and dream. Verify queued/running/done states, result rendering, history, and local cup overlay.

- [ ] **Step 4: Run supporting flows**

  Test light/dark theme, Turkish diacritics, share card, notification deeplink, prediction verdict, purchase restore, and profile legal links.

- [ ] **Step 5: Test recoverable failures**

  Disable network during an API call, wait for the shared timeout, reconnect and retry. Kill/reopen the app while a reading runs and confirm the result remains accessible from history.

- [ ] **Step 6: Test deletion last**

  Request data deletion, verify the UI confirms it, and verify the backend marks/removes the account according to policy. Use a dedicated test identity because this step intentionally destroys its data.

- [ ] **Step 7: Record evidence**

  Mark each checklist row with device model, Android version, build/version code, date, and a non-sensitive screenshot or log link.

### Task 5: Build and upload the production AAB

**Files:**
- Modify: `fal-mobile/app.json` only for approved version/versionCode changes if EAS remote versioning does not own them
- Test: `fal-mobile/eas.json`

**Interfaces:**
- Consumes: EAS project ID, RevenueCat public Android key, production API URL
- Produces: signed AAB in Play internal testing

- [ ] **Step 1: Verify release environment**

  Run `npm run config:release` and `npm run release:check` with production variables; expect both to pass without printing credential values.

- [ ] **Step 2: Verify package and version ownership**

  Confirm Expo resolves `android.package=com.telve.app`, EAS uses remote app version source, and `autoIncrement=true` for production. Do not manually bump both local and remote version codes.

- [ ] **Step 3: Build AAB**

  Run `eas build -p android --profile production`; verify the build uses `https://api.telve.app`, completes successfully, and produces an Android App Bundle rather than APK.

- [ ] **Step 4: Submit as draft internal release**

  Run `eas submit -p android --profile production --latest` or upload the exact AAB manually. Confirm track `internal` and release status `draft` before submission.

- [ ] **Step 5: Inspect Play processing**

  Resolve only blocking manifest, signing, target SDK, native crash, or billing errors. Do not expand scope for non-blocking optimization suggestions.

### Task 6: Complete store listing and declarations

**Files:**
- Source: `fal-mobile/docs/play-store.md`
- Modify: `fal-mobile/docs/release-checklist.md`
- External: Play Console store listing and App content forms

**Interfaces:**
- Consumes: approved copy, screenshots, legal URLs, actual SDK state
- Produces: savable Play listing with consistent declarations

- [ ] **Step 1: Upload listing copy**

  Use the exact app name, short description, full description, Lifestyle category, and 18+ positioning from `play-store.md`; remove any statement not demonstrated by the accepted build.

- [ ] **Step 2: Upload graphics**

  Upload production icon, feature graphic, and at least four phone screenshots in this order: personal chart, cup capture, symbol overlay/result, Kader Günlüğü; add history and other rituals if six–eight strong images exist.

- [ ] **Step 3: Complete Data Safety from resolved config**

  Declare RevenueCat/Play purchase data active, AppLovin and PostHog inactive, photos temporarily processed, user content processed by the LLM provider, and deletion available in-app and by URL. Match the shipped build, not future capability.

- [ ] **Step 4: Complete app-content forms**

  Enter privacy URL, data deletion URL, 18+ target audience, entertainment disclaimer, no ads for v1, digital purchases yes, and permissions rationale for camera and notifications.

- [ ] **Step 5: Save evidence**

  Record dated screenshots or exported answers in the release checklist without committing personal addresses or account identifiers beyond what is already intentionally public in legal pages.

### Task 7: Decide and promote

**Files:**
- Modify: `fal-mobile/docs/release-checklist.md`

**Interfaces:**
- Consumes: completed checklist, CI links, Play test order, pre-launch report
- Produces: explicit promote or block decision

- [ ] **Step 1: Review automated gates**

  Confirm main CI, release check, backend pytest, Expo Doctor, production AAB, and Play processing are green.

- [ ] **Step 2: Review operational gates**

  Confirm API/worker/scheduler restart, database restore test, block seed, HTTPS legal pages, and one production reading are green.

- [ ] **Step 3: Review commerce and device gates**

  Confirm purchase, webhook tier, quota, restore, expiration behavior, all four rituals, network recovery, and deletion are green.

- [ ] **Step 4: Review pre-launch report**

  Block on reproducible crash, ANR, broken startup, inaccessible critical control, or policy violation. Record non-blocking device-specific warnings for post-launch triage.

- [ ] **Step 5: Promote**

  If every blocking row is green, promote the exact tested artifact to the user's eligible release track. If any is red, leave the release as draft and open one narrowly scoped blocker task.

- [ ] **Step 6: Commit the completed checklist**

  Remove private test order IDs and user identifiers, then commit public/redacted evidence with `docs: record Telve release readiness`.

