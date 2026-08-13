# APK Build Design

## Goal

Produce an installable Telve Android preview APK from the release-blocker fix branch without merging it into the default branch.

## Design

- Reuse the existing `.github/workflows/eas-preview.yml` local Gradle build; do not add a second build system.
- Extend its push branch filter to `fix/**`, so publishing `fix/release-blockers-20260812` starts the build automatically.
- Keep the live preview API URL already configured by the workflow.
- Download the resulting `telve-apk` artifact and verify the ZIP contains `app-release.apk`.

## Failure Handling

- If the workflow fails, inspect the failed job logs, apply only the root-cause fix, and rerun.
- Do not merge into the default branch as part of APK production.

## Verification

- Validate the workflow YAML and mobile checks before publishing.
- Confirm the GitHub Actions run completes successfully.
- Confirm the downloaded APK exists and report its size and SHA-256 digest.
