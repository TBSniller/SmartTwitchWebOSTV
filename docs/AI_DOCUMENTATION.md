# SmartTwitchTV webOS Port - AI Documentation

This document provides AI-oriented architecture context and a documentation map for this fork.

## AI Context Summary
- Fork model: webOS wrapper + hosted bridge adaptation, with upstream app logic preserved.
- Canonical adaptation files:
  - `webos/app/index.js`
  - `webos/app/appinfo.json`
  - `webos/bridge/webosCompatBridge.js`
  - `tools/upstream/prepareHostedRelease.js`
- Tracked `release/` remains an upstream mirror; bridge injection is artifact-time, not tracked in `release/`.
- Hosted channels:
  - Stable: `/release/index.html` (from `master`)
  - Dev: `/dev/index.html` (from `dev/pages-publish`)

## Runtime Behavior Notes
- `window.Android` API compatibility is required for `app/specific/OSInterface.js`.
- Legacy startup watchdog/reload state-machine logic was removed after upstream Android audit found no equivalent.
- Debug logging is disabled by default and enabled only via:
  - `?sttv_debug=1`
  - `localStorage.STTV_DEBUG = "1"`

## Tooling and Automation Map
- Upstream sync tooling:
  - `tools/upstream/syncUpstreamRelease.js`
  - `tools/upstream/syncUpstreamAndroidContext.js`
  - `tools/upstream/prepareHostedRelease.js`
- Release tooling:
  - `tools/release/verifyReleaseTag.js`
  - `tools/release/generateHomebrewArtifacts.js`
  - `tools/release/prepareDevAppVariant.js`
  - `tools/release/generatePrereleaseManifest.js`
- Device command wrapper:
  - `tools/webos/runAresCommand.js`
- Automation workflows:
  - `.github/workflows/sync-upstream-release.yml`
  - `.github/workflows/deploy-pages.yml`
  - `.github/workflows/release.yml`
  - `.github/workflows/release-dev-prerelease.yml`

## Canonical Doc Ownership
- Upstream sync procedure: `docs/UPSTREAM_SYNC_PLAYBOOK.md`
- Build/package/deploy/release operations: `docs/WEBOS_DEPLOYMENT.md`
- Current implementation/parity snapshot: `docs/WEBOS_PORTING_STATUS.md`
- Platform limitations and non-1:1 rationale: `docs/WEBOS_LIMITATIONS.md`
- Deep references:
  - `docs/ANDROID_TO_WEBOS_FLOW_MAPPING.md`
  - `docs/WEBOS_BRIDGE_PERFORMANCE_AUDIT.md`

## AI Local Context
- Local-only context root: `.ai_context/` (git-ignored).
- Android context snapshot target: `.ai_context/android_upstream/latest/`.
- Optional local comparison repos may exist under `.ai_context/template-[REPO]/`.

## References
- Back button: https://webostv.developer.lge.com/develop/guides/back-button
- Lifecycle: https://webostv.developer.lge.com/develop/guides/app-lifecycle-management
- `appinfo.json`: https://webostv.developer.lge.com/develop/references/appinfo-json
