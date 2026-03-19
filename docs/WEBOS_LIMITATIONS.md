# webOS Limitations and Non-1:1 Transfers (Canonical)

This document is the canonical rationale for behavior that cannot match Android 1:1 in this fork.

## 1) True Multi-Video Playback

Status: **Not 1:1 possible in webOS web app context**

Reason:
- webOS web app media runtime does not provide Android ExoPlayer-style multi-instance parity.

Impact:
- Multi-stream features are compatibility-mapped but hardware-limited.
- Bridge keeps `window.Android` API shape while enforcing webOS-safe behavior.

## 2) Android Background Services and Notifications

Status: **Not transferable**

Reason:
- Android background services and notification channels do not have direct equivalents in the standard webOS web app sandbox.

Impact:
- Notification service methods remain API-compatible stubs/no-ops where needed.

## 3) APK / Play Store Update Flow

Status: **Not transferable**

Reason:
- Android APK update/install flow is platform-specific.

Impact:
- Update-related bridge calls remain compatibility paths, not APK install behavior.

## 4) Pre-Navigation Native Bridge Parity

Status: **Not 1:1 transferable for arbitrary external pages**

Reason:
- Android can set up native bridge behavior before WebView content load.
- webOS wrapper cannot provide equivalent native preload semantics for arbitrary third-party targets.

Impact:
- Deterministic bootstrap is guaranteed for this fork-hosted path by staged bridge injection before `main.js` in channel roots (`/release/index.html`, `/dev/index.html`).

## 5) DNS Filtering / Sinkhole Side Effects

Status: **Partially mitigated**

Reason:
- DNS-level blocking can produce repeated timeout/failure patterns in browser XHR pathways.

Impact:
- Bridge hardening reduces timeout storms and UI lockups.
- Playback can still fail under aggressive filtering.

## 6) Player Telemetry Parity

Status: **Partially transferable**

Reason:
- Android exposes native ExoPlayer analytics not available at equivalent fidelity in browser media APIs.

Impact:
- `getVideoStatus` payload shape is preserved, but some metrics are best-effort approximations on webOS.

## 7) Home Feed Thumbnail Video Preview

Status: **Disabled by default**

Reason:
- Feed preview playback is unstable on some webOS engines/devices.

Impact:
- Disabled by default in bridge runtime.
- Debug override remains available (`?sttv_feed_preview=1` or `localStorage.STTV_FEED_PREVIEW=1`).

## 8) Sync HTTP Compatibility Path (`mMethodUrlHeaders`)

Status: **Intentionally retained for compatibility**

Reason:
- Upstream `OSInterface` call sites rely on synchronous return behavior.

Impact:
- Sync XHR can still block main thread under poor network conditions.
- Timeout/circuit-breaker hardening reduces, but cannot eliminate, this trade-off.

## 9) Hosted Channel Coupling (`/release`, `/dev`)

Status: **Intentionally retained**

Reason:
- Stable wrapper defaults are coupled to `/release/index.html`.
- Dev prerelease wrapper defaults are coupled to `/dev/index.html`.
- Pages deployment composes both channels in one artifact (`/release` from `master`, `/dev` from `dev/pages-publish`).

Impact:
- Removing or renaming hosted channels requires a dedicated migration refactor across wrapper defaults and CI workflows.

## Related Docs
- Current implementation/parity snapshot: `docs/WEBOS_PORTING_STATUS.md`
- Upstream sync procedure: `docs/UPSTREAM_SYNC_PLAYBOOK.md`
- Build/deploy operations: `docs/WEBOS_DEPLOYMENT.md`
- Bridge deep audit: `docs/WEBOS_BRIDGE_PERFORMANCE_AUDIT.md`

## Sources
- webOS FAQ: https://webostv.developer.lge.com/faq?category=FAQ&search=video
- webOS app types: https://webostv.developer.lge.com/develop/getting-started/app-types
- webOSTV.js intro: https://webostv.developer.lge.com/develop/references/webostvjs-introduction
