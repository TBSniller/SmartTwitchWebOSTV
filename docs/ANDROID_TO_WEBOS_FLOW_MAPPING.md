# Android -> webOS Flow Mapping

This document maps the original Android player flow (`.ai_context/android_upstream/latest/apk/app/src/main/java/com/fgl27/twitch/PlayerActivity.java` after local context sync) to the hosted webOS bridge (`webos/bridge/webosCompatBridge.js`).

## 1) Main playback start / restore

Android flow:
- JS calls `OSInterface_StartAuto(...)` -> Java `StartAuto(...)`.
- Java creates/reuses PlayerObj 0 (main) and starts ExoPlayer.
- On player errors, Java uses `PlayerEventListenerCheckCounter` / `PlayerEventListenerClear` callbacks.

webOS mapping:
- JS calls `Android.StartAuto(...)` -> hosted bridge `setMain(...)`.
- Main playback uses `video#sttv_main`.
- Bridge keeps Android callback semantics with `Play_PannelEndStart(...)` and periodic recovery.
- Cold-start hardening:
  - `supportQuickStart: false` in `webos/app/appinfo.json`.
  - Launch token in `webos/app/index.js` (`sttv_webos_launch`).
  - Bridge is loaded directly in hosted `release/index.html` before upstream `main.js`.

## 2) Hover preview on start screen

Android flow:
- JS calls `OSInterface_StartFeedPlayer(...)` -> Java `StartFeedPlayer(...)`.
- Java starts preview player (PlayerObj 4) in feed rectangle.

webOS mapping:
- JS calls `Android.StartFeedPlayer(...)` -> hosted bridge `setPrev(..., 'feed', ...)`.
- Preview playback uses `video#sttv_preview` and feed rect positioning.
- Stalls/errors are retried before reporting `Play_CheckIfIsLiveClean(...)`.

## 3) Open stream from preview

Android flow:
- JS calls `OSInterface_ReuseFeedPlayer(...)`.
- Java may move/reuse PlayerObj 4 into main path (`ReUsePlayer`), then clears preview player.

webOS mapping:
- JS calls `Android.ReuseFeedPlayer(...)`.
- For main target player, bridge promotes source into main (`setMain(...)`) and clears preview tracking.
- Multi/PiP-only branches are blocked with explicit warning (platform limit).

## 4) Back / exit from stream

Android flow:
- Back goes through `KEYCODE_F2` bridge mapping.
- `Play_shutdownStream()` -> `Play_PreshutdownStream()` -> Java `stopVideo()` or `mClearSmallPlayer()`.
- Player state and scene are cleaned before returning to screen 1.

webOS mapping:
- Back key aliasing maps webOS back variants to Android-style F2 key path.
- `Android.stopVideo()` clears both main and preview players.
- Additional scene safety patches:
  - when scene switches back to screen 1 (`Main_showScene1Doc` / `Main_hideScene2Doc`), bridge verifies and force-clears active video if playback scene is left.
  - prevents hidden/background main playback when returning to start screen.

## 5) Browser fallback path

Android/original web behavior:
- Browser embed path (`BrowserTest*`) is used only when `Main_IsOn_OSInterface` is false.

webOS mapping:
- Bridge seeds OSInterface globals early and blocks embed script insertion path.
- Hosted `index.html` bridge-first load is the primary mitigation (no late userscript injection).

## 6) Non 1:1 items

- Android ExoPlayer multi-instance behavior cannot be fully replicated in webOS web app video pipeline.
- Multi/PiP operations are rejected in bridge with user-facing warning and single-player fallback behavior.
