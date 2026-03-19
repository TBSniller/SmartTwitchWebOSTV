# webOS Porting Status (Canonical)

This document is the canonical current-state snapshot for wrapper/bridge parity in this fork.

## Architecture Status
- webOS stable wrapper app (`webos/app`) launches hosted `release/index.html`.
- Hosted bridge source is `webos/bridge/webosCompatBridge.js`.
- Deploy staging injects `webosCompatBridge.js` before upstream `main.js` in staged hosted channels (`release/index.html`, `dev/index.html`).
- Tracked `release/` is maintained as an upstream mirror (no tracked bridge patching).
- Upstream `app/` remains unmodified for webOS adaptation.

## Runtime Compatibility Status
- `window.Android` surface required by `app/specific/OSInterface.js` is preserved via bridge mapping.
- Core playback, preview playback, key handling, and platform-back flow are implemented.
- Lifecycle handling (`visibilitychange`, `webkitvisibilitychange`, page show/hide) is implemented with guarded resume/stop behavior.
- Relaunch/deeplink passthrough is implemented (`GetLastIntentObj`, `webOSRelaunch`).

## Bridge/Parity Snapshot
- Current bridge method totals in `initAndroid()`:
  - IMPLEMENTED: 68
  - ALIAS: 8
  - NO-OP: 38
  - HARDWARE-LTD: 5
- Detailed parity matrix lives in `docs/WEBOS_BRIDGE_PERFORMANCE_AUDIT.md`.

## Cleanup and Hardening Status
- Legacy watchdog/reload/race recovery state-machine logic is removed.
- Loader flicker and hot-path DOM pressure hardening are applied in bridge runtime paths.
- Freeze-risk mitigations were added for sync request timeout handling, lifecycle unblock, and timer deduping.

## Non-1:1 Areas (Expected)
- True Android-style multi-instance playback.
- Android background service behavior.
- APK update/install flow.
- Certain telemetry fidelity differences.

Canonical rationale is in `docs/WEBOS_LIMITATIONS.md`.

## Automation Status
- Upstream sync automation exists in `.github/workflows/sync-upstream-release.yml`.
- Pages deploy automation exists in `.github/workflows/deploy-pages.yml` and publishes both `/release` and `/dev`.
- Tag-based release automation exists in `.github/workflows/release.yml`.
- Manual dev prerelease automation exists in `.github/workflows/release-dev-prerelease.yml`.

## Related Docs
- Upstream sync procedure: `docs/UPSTREAM_SYNC_PLAYBOOK.md`
- Build/package/deploy/release operations: `docs/WEBOS_DEPLOYMENT.md`
- Limitations rationale: `docs/WEBOS_LIMITATIONS.md`
- Android flow mapping reference: `docs/ANDROID_TO_WEBOS_FLOW_MAPPING.md`
