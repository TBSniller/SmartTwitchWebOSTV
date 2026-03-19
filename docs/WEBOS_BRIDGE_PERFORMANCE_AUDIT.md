# webOS Bridge Performance Audit

Audit date: 2026-03-01

## Scope
- File audited: `webos/bridge/webosCompatBridge.js`
- Focus: loader flicker, hot-path DOM pressure, micro-allocations, Android parity status for `window.Android` bridge surface.
- Constraints: keep webOS adaptation in bridge/wrapper only; no upstream app source rewrites.

## Findings Summary (P0-P3)

| Priority | Finding | Root Cause | Implemented Change | Result |
| --- | --- | --- | --- | --- |
| P0 | Loader flicker during fast playback start | Four direct `setMainLoading(true)`/`setFeedLoading(true)` calls bypassed existing 450ms debounce gate | Replaced direct show calls with `requestMainLoadingShow()`/`requestFeedLoadingShow()` in `setMain`, `setPrev`, `retryMainPlayback`, `retryPreviewPlayback` | No short spinner flash for sub-450ms starts; long stalls still show loader |
| P1 | DOM thrash in loader auto-clear path | `maybeAutoClearMainLoading()` repeatedly triggered DOM lookups/style reads from media events | Added in-memory visibility flags, browser-fallback TTL cache, and display state booleans | Hot path avoids repeated DOM reads in steady state |
| P2 | avoidable GC pressure in timeline reads | `getVideoTimelineState()` created fresh object literals each call | Reused preallocated result objects (`timelineResultMain/Preview/Temp`) | Lower allocation churn on frequent timeline polling |
| P2 | unnecessary duration reads | duration refresh path hit both players even when only one value needed | Split into `refreshMainDurationCache()` + `refreshPreviewDurationCache()` | Reads only required media element per request |
| P3 | redundant style writes in layout updates | `applyRect()` wrote CSS values even when unchanged | Added rect cache and no-op guard for identical values | Fewer style invalidations/layout work |

## Freeze/Black-Screen Risk Analysis (2026-03-01 Follow-up)

| Priority | Risk | Root Cause | Implemented Mitigation | Expected Effect |
| --- | --- | --- | --- | --- |
| P0 | UI freeze from blocking sync request | Sync `mMethodUrlHeaders` path in `xhrReq` did not always apply timeout in the sync branch | Timeout assignment moved directly after `x.open(...)` for both sync and async paths (runtime-supported) | Reduced worst-case main-thread stalls on degraded networks |
| P0 | Input lock after lifecycle stop | Stop path can enable upstream key blocker (`Main_PreventClick(true, ...)`) and remain sticky on unreliable resume | `tryLifecycleResume()` now clears stop blockers before and after `Main_CheckResume` when suspended/stopped | Lower probability of "no remote input" stuck state after resume/relaunch |
| P1 | Chat/UI pressure from global DOM patch hot path | Embed-blocking wrapper runs through `appendChild`/`insertBefore` and previously did heavier node/tag coercion | `shouldBlockEmbedScriptNode()` now uses low-cost early exits (`nodeType`, direct tag check, lazy src read) | Lower per-append overhead under high chat throughput |
| P1 | Timer accumulation in scene safety cleanup | Repeated `stopMainIfLeavingPlayerScene()` calls queued multiple delayed timers | Added single deduped timer id (`sceneSafetyStopTimerId`) with clear/reset behavior | Less timer churn, lower delayed callback pressure |
| P2 | Visibility/state drift after recovery | Remaining style-read and cache state could diverge after relaunch/recovery | Preview visibility checks switched to in-memory state; recovery now resyncs visibility flags and invalidates fallback cache | More deterministic active-state behavior after relaunch |

## Playback Recovery Hardening (2026-03-19)

- Main stall handling is now classification-driven (`transient`, `network_buffering`, `decoder_jam`) instead of treating all stalls as reload-worthy.
- Network starvation keeps existing retry behavior, but hard reloads (`mv.load()`) are now cooldown-limited to 2 attempts per 30s window.
- Decoder/surface jam path now uses a soft recovery (`pause()` + `play()`) with follow-up verification before escalation, avoiding immediate pipeline teardown/rebuild.
- Main progress tracking is updated from `loadedmetadata/canplay/playing/loadeddata/timeupdate/progress`, so stall decisions are based on observed forward progress rather than `readyState` alone.
- `stalled` event handling keeps the no-flicker fast path (no forced loader show for `readyState >= 3`) while still scheduling hidden stall rechecks to catch persistent decoder jams.

## Before/After Details

### Loader visibility behavior
- Before: playback start paths could call loader-show directly, bypassing debounce.
- After: all startup/retry show-paths route through existing debounce/hysteresis helpers; hide remains immediate.

### DOM hot path reductions
- `isMainLoadingVisible()` now returns tracked state, not DOM query results.
- `isBrowserFallbackVisible()` uses a 2s cache TTL and invalidates during recovery.
- `isMainActive()`/`isPreviewActive()` rely on tracked show/hide booleans instead of style reads.
- Codec capability probing reuses one hidden probe element.

### Micro-optimizations
- Timeline state object reuse avoids per-call object creation.
- Duration cache reads are split by target video element.
- Layout rectangle application now guards against unchanged values.

## Remaining Trade-offs
- `mMethodUrlHeaders` intentionally preserves synchronous XHR support for Android API compatibility; this can still block the main thread under slow network conditions, even with timeout hardening.
- Notification-service APIs remain no-op because webOS web apps have no Android-style background service runtime.
- Multi-stream/small-window paths stay hardware-limited on webOS (single decoder constraints), therefore guarded/no-op behavior is retained.

## Android Bridge Method Parity Matrix

Method count in initAndroid(): 119
- IMPLEMENTED: 68
- ALIAS: 8
- NO-OP: 38
- HARDWARE-LTD: 5

| Method | Line | Status | Android equivalent / mapping | Perf risk |
| --- | ---: | --- | --- | --- |
| `mMethodUrlHeaders` | 3105 | IMPLEMENTED | OSInterface.mMethodUrlHeaders (sync HTTP bridge) | Medium (sync XHR can block main thread) |
| `BasexmlHttpGet` | 3107 | IMPLEMENTED | OSInterface.BasexmlHttpGet (async HTTP bridge) | Medium (network latency dependent) |
| `XmlHttpGetFull` | 3109 | IMPLEMENTED | OSInterface.XmlHttpGetFull (async HTTP bridge/full checks) | Medium (network latency dependent) |
| `StartAuto` | 3115 | IMPLEMENTED | OSInterface.StartAuto | Low |
| `ReuseFeedPlayerPrepare` | 3121 | IMPLEMENTED | OSInterface.ReuseFeedPlayerPrepare | Low |
| `ReuseFeedPlayer` | 3126 | IMPLEMENTED | OSInterface.ReuseFeedPlayer | Low |
| `FixViewPosition` | 3145 | IMPLEMENTED | OSInterface.FixViewPosition | Low |
| `RestartPlayer` | 3158 | IMPLEMENTED | OSInterface.RestartPlayer | Low |
| `SetQuality` | 3184 | IMPLEMENTED | OSInterface.SetQuality | Low |
| `getQualities` | 3195 | IMPLEMENTED | OSInterface.getQualities | Low |
| `SetMainPlayerBitrate` | 3197 | IMPLEMENTED | OSInterface.SetMainPlayerBitrate | Low |
| `SetSmallPlayerBitrate` | 3203 | IMPLEMENTED | OSInterface.SetSmallPlayerBitrate | Low |
| `stopVideo` | 3213 | IMPLEMENTED | OSInterface.stopVideo | Low |
| `mClearSmallPlayer` | 3223 | IMPLEMENTED | OSInterface.mClearSmallPlayer | Low |
| `SetPreviewSize` | 3230 | IMPLEMENTED | OSInterface.SetPreviewSize | Low |
| `SetFeedPosition` | 3235 | IMPLEMENTED | OSInterface.SetFeedPosition | Low |
| `StartFeedPlayer` | 3241 | HARDWARE-LTD | OSInterface.StartFeedPlayer | None (guarded by capability checks) |
| `SetPlayerViewFeedBottom` | 3249 | IMPLEMENTED | OSInterface.SetPlayerViewFeedBottom | Low |
| `SetPlayerViewSidePanel` | 3256 | IMPLEMENTED | OSInterface.SetPlayerViewSidePanel | Low |
| `StartSidePanelPlayer` | 3261 | HARDWARE-LTD | OSInterface.StartSidePanelPlayer | None (guarded by capability checks) |
| `StartScreensPlayer` | 3266 | HARDWARE-LTD | OSInterface.StartScreensPlayer | None (guarded by capability checks) |
| `ScreenPlayerRestore` | 3278 | NO-OP | OSInterface.ScreenPlayerRestore | None (stub only) |
| `SidePanelPlayerRestore` | 3287 | NO-OP | OSInterface.SidePanelPlayerRestore | None (stub only) |
| `ClearFeedPlayer` | 3289 | IMPLEMENTED | OSInterface.ClearFeedPlayer | Low |
| `ClearSidePanelPlayer` | 3291 | IMPLEMENTED | OSInterface.ClearSidePanelPlayer | Low |
| `StartMultiStream` | 3293 | HARDWARE-LTD | OSInterface.StartMultiStream | None (guarded by capability checks) |
| `EnableMultiStream` | 3300 | HARDWARE-LTD | OSInterface.EnableMultiStream | None (guarded by capability checks) |
| `DisableMultiStream` | 3306 | IMPLEMENTED | OSInterface.DisableMultiStream | Low |
| `mSetPlayerPosition` | 3311 | IMPLEMENTED | OSInterface.mSetPlayerPosition | Low |
| `mSetPlayerSize` | 3313 | IMPLEMENTED | OSInterface.mSetPlayerSize | Low |
| `mSwitchPlayerPosition` | 3315 | ALIAS | OSInterface.mSwitchPlayerPosition (alias -> OSInterface.mSetPlayerPosition) | Low |
| `mSwitchPlayerSize` | 3317 | ALIAS | OSInterface.mSwitchPlayerSize (alias -> OSInterface.mSetPlayerSize) | Low |
| `mSwitchPlayer` | 3319 | IMPLEMENTED | OSInterface.mSwitchPlayer | Low |
| `mupdatesize` | 3330 | IMPLEMENTED | OSInterface.mupdatesize | Low |
| `mupdatesizePP` | 3332 | ALIAS | OSInterface.mupdatesizePP (alias -> OSInterface.mupdatesize) | Low |
| `SetFullScreenPosition` | 3334 | IMPLEMENTED | OSInterface.SetFullScreenPosition | Low |
| `SetFullScreenSize` | 3336 | IMPLEMENTED | OSInterface.SetFullScreenSize | Low |
| `mSetlatency` | 3340 | NO-OP | OSInterface.mSetlatency | None (stub only) |
| `msetPlayer` | 3344 | NO-OP | OSInterface.msetPlayer | None (stub only) |
| `SetLanguage` | 3351 | IMPLEMENTED | OSInterface.SetLanguage | Low |
| `upDateLang` | 3357 | ALIAS | OSInterface.upDateLang (alias -> OSInterface.SetLanguage) | Low |
| `setAppIds` | 3359 | NO-OP | OSInterface.setAppIds | None (stub only) |
| `setSpeedAdjustment` | 3365 | NO-OP | OSInterface.setSpeedAdjustment | None (stub only) |
| `SetCheckSource` | 3369 | NO-OP | OSInterface.SetCheckSource | None (stub only) |
| `SetBuffer` | 3373 | NO-OP | OSInterface.SetBuffer | None (stub only) |
| `SetCurrentPositionTimeout` | 3375 | NO-OP | OSInterface.SetCurrentPositionTimeout | None (stub only) |
| `mKeepScreenOn` | 3377 | NO-OP | OSInterface.mKeepScreenOn | None (stub only) |
| `SetKeysOpacity` | 3382 | IMPLEMENTED | OSInterface.SetKeysOpacity | Low |
| `SetKeysPosition` | 3384 | NO-OP | OSInterface.SetKeysPosition | None (stub only) |
| `SetNotificationPosition` | 3392 | NO-OP | OSInterface.SetNotificationPosition | None (stub only) |
| `SetNotificationRepeat` | 3396 | NO-OP | OSInterface.SetNotificationRepeat | None (stub only) |
| `SetNotificationSinceTime` | 3400 | NO-OP | OSInterface.SetNotificationSinceTime | None (stub only) |
| `RunNotificationService` | 3404 | NO-OP | OSInterface.RunNotificationService | None (stub only) |
| `StopNotificationService` | 3406 | NO-OP | OSInterface.StopNotificationService | None (stub only) |
| `upNotificationState` | 3408 | NO-OP | OSInterface.upNotificationState | None (stub only) |
| `SetNotificationLive` | 3412 | NO-OP | OSInterface.SetNotificationLive | None (stub only) |
| `SetNotificationTitle` | 3416 | NO-OP | OSInterface.SetNotificationTitle | None (stub only) |
| `SetNotificationGame` | 3420 | NO-OP | OSInterface.SetNotificationGame | None (stub only) |
| `Settings_SetPingWarning` | 3424 | NO-OP | OSInterface.Settings_SetPingWarning | None (stub only) |
| `UpdateBlockedChannels` | 3432 | NO-OP | OSInterface.UpdateBlockedChannels | None (stub only) |
| `UpdateBlockedGames` | 3436 | NO-OP | OSInterface.UpdateBlockedGames | None (stub only) |
| `UpdateUserId` | 3440 | NO-OP | OSInterface.UpdateUserId | None (stub only) |
| `setBlackListMediaCodec` | 3446 | NO-OP | OSInterface.setBlackListMediaCodec | None (stub only) |
| `setBlackListQualities` | 3450 | NO-OP | OSInterface.setBlackListQualities | None (stub only) |
| `CheckReUsePlayer` | 3454 | NO-OP | OSInterface.CheckReUsePlayer | None (stub only) |
| `mhideSystemUI` | 3460 | NO-OP | OSInterface.mhideSystemUI | None (stub only) |
| `KeyboardCheckAndHIde` | 3462 | NO-OP | OSInterface.KeyboardCheckAndHIde | None (stub only) |
| `hideKeyboardFrom` | 3464 | NO-OP | OSInterface.hideKeyboardFrom | None (stub only) |
| `showKeyboardFrom` | 3466 | NO-OP | OSInterface.showKeyboardFrom | None (stub only) |
| `isKeyboardConnected` | 3468 | NO-OP | OSInterface.isKeyboardConnected | None (stub only) |
| `initbodyClickSet` | 3470 | NO-OP | OSInterface.initbodyClickSet | None (stub only) |
| `clearCookie` | 3472 | IMPLEMENTED | OSInterface.clearCookie (alias -> clearCookiesForCurrentDomain) | Low |
| `gettime` | 3474 | IMPLEMENTED | OSInterface.gettime | Low |
| `getsavedtime` | 3476 | ALIAS | OSInterface.getsavedtime (alias -> OSInterface.gettime) | Low |
| `gettimepreview` | 3478 | IMPLEMENTED | OSInterface.gettimepreview | Low |
| `mseekTo` | 3480 | IMPLEMENTED | OSInterface.mseekTo | Low |
| `PlayPause` | 3486 | IMPLEMENTED | OSInterface.PlayPause | Low |
| `PlayPauseChange` | 3498 | IMPLEMENTED | OSInterface.PlayPauseChange | Low |
| `getPlaybackState` | 3505 | IMPLEMENTED | OSInterface.getPlaybackState | Low |
| `setPlaybackSpeed` | 3507 | IMPLEMENTED | OSInterface.setPlaybackSpeed | Low |
| `getDuration` | 3514 | IMPLEMENTED | OSInterface.getDuration | Low |
| `updateScreenDuration` | 3519 | IMPLEMENTED | OSInterface.updateScreenDuration | Low |
| `getVideoStatus` | 3524 | IMPLEMENTED | OSInterface.getVideoStatus | Low-Medium (telemetry paths) |
| `getVideoQuality` | 3531 | IMPLEMENTED | OSInterface.getVideoQuality | Low |
| `getLatency` | 3533 | IMPLEMENTED | OSInterface.getLatency | Low-Medium (telemetry paths) |
| `SetAudioEnabled` | 3543 | IMPLEMENTED | OSInterface.SetAudioEnabled | Low |
| `SetVolumes` | 3548 | IMPLEMENTED | OSInterface.SetVolumes | Low |
| `ApplyAudio` | 3553 | ALIAS | OSInterface.ApplyAudio (alias -> applyAudio) | Low |
| `SetPreviewAudio` | 3555 | IMPLEMENTED | OSInterface.SetPreviewAudio | Low |
| `SetPreviewOthersAudio` | 3557 | IMPLEMENTED | OSInterface.SetPreviewOthersAudio | Low |
| `keyEvent` | 3559 | IMPLEMENTED | OSInterface.keyEvent | Low |
| `OpenExternal` | 3561 | ALIAS | OSInterface.OpenExternal (alias -> launchExternal) | Low |
| `OpenURL` | 3561 | ALIAS | OSInterface.OpenURL (alias -> launchExternal) | Low |
| `mloadUrl` | 3563 | IMPLEMENTED | OSInterface.mloadUrl | Low |
| `CleanAndLoadUrl` | 3568 | IMPLEMENTED | OSInterface.CleanAndLoadUrl | Low |
| `mPageUrl` | 3586 | IMPLEMENTED | OSInterface.mPageUrl | Low |
| `mclose` | 3588 | IMPLEMENTED | OSInterface.mclose | Low |
| `mshowLoading` | 3600 | IMPLEMENTED | OSInterface.mshowLoading | Low (explicit app-level loader control) |
| `mshowLoadingBottom` | 3602 | IMPLEMENTED | OSInterface.mshowLoadingBottom | Low (explicit app-level loader control) |
| `AvoidClicks` | 3604 | IMPLEMENTED | OSInterface.AvoidClicks | Low |
| `getversion` | 3606 | IMPLEMENTED | OSInterface.getversion (alias -> getCompatibleVersion) | Low |
| `getdebug` | 3608 | IMPLEMENTED | OSInterface.getdebug | Low |
| `getDevice` | 3610 | IMPLEMENTED | OSInterface.getDevice | Low |
| `getManufacturer` | 3612 | IMPLEMENTED | OSInterface.getManufacturer | Low |
| `getSDK` | 3614 | IMPLEMENTED | OSInterface.getSDK | Low |
| `deviceIsTV` | 3616 | IMPLEMENTED | OSInterface.deviceIsTV | Low |
| `getWebviewVersion` | 3618 | IMPLEMENTED | OSInterface.getWebviewVersion | Low |
| `getcodecCapabilities` | 3620 | IMPLEMENTED | OSInterface.getcodecCapabilities | Low |
| `isAccessibilitySettingsOn` | 3622 | NO-OP | OSInterface.isAccessibilitySettingsOn | None (stub only) |
| `hasNotificationPermission` | 3624 | IMPLEMENTED | OSInterface.hasNotificationPermission | Low |
| `getInstallFromPLay` | 3626 | IMPLEMENTED | OSInterface.getInstallFromPLay | Low |
| `showToast` | 3628 | NO-OP | OSInterface.showToast | None (stub only) |
| `LongLog` | 3632 | NO-OP | OSInterface.LongLog | None (stub only) |
| `getAppToken` | 3636 | IMPLEMENTED | OSInterface.getAppToken | Low |
| `setAppToken` | 3638 | IMPLEMENTED | OSInterface.setAppToken | Low |
| `GetLastIntentObj` | 3640 | NO-OP | OSInterface.GetLastIntentObj | None (stub only) |
| `mCheckRefresh` | 3642 | IMPLEMENTED | OSInterface.mCheckRefresh | Low |
| `mCheckRefreshToast` | 3644 | NO-OP | OSInterface.mCheckRefreshToast | None (stub only) |
| `UpdateAPK` | 3648 | IMPLEMENTED | OSInterface.UpdateAPK | Low |

## Verification
Use the canonical operational validation flow in `docs/WEBOS_DEPLOYMENT.md` (local build and validation section).
