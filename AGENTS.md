# AGENTS

## Canonical Agent Policy
- This file is the canonical agent instruction source for this repository.
- `CLAUDE.md` and `CODEX.md` are intentionally a thin compatibility pointer and must not duplicate policy content.
- This repository has multi model/agent support. Always preserve this support.

## Project Scope
- This repository is a SmartTwitchTV fork with a webOS wrapper app.
- Primary webOS runtime files are in `webos/app/`.
- The wrapper loads a hosted release page from this fork.
- Goal: keep upstream app sources unchanged and implement webOS platform logic in hosted bridge/wrapper only.

## Architecture Rules
- Keep webOS-specific adaptation inside:
  - `webos/app/index.js`
  - `webos/app/appinfo.json`
  - `webos/bridge/webosCompatBridge.js`
  - `tools/upstream/prepareHostedRelease.js` artifact bridge injection
- Do not modify upstream source under `app/` for webOS fixes.
- Exception: bridge source under `webos/bridge/**` is fork-owned for webOS bridge/runtime compatibility.
- If absolutely unavoidable, document why wrapper/hosted bridge could not solve it and keep the diff minimal.
- Do not reintroduce Twitch browser/embed fallback for webOS player paths.
- Preserve Android bridge API surface (`window.Android`) expected by `app/specific/OSInterface.js`.

## Upstream Sync Strategy
- Upstream release sync must go through `npm run sync:upstream:release`.
- Sync compares upstream `HEAD:release` tree SHA and no-ops when unchanged.
- On change, sync replaces local tracked `release/` as a pure upstream mirror.
- Sync hard-fails when legacy bridge patch artifacts are detected in tracked `release/`.
- Android upstream context sync is local-only and must go through `npm run sync:upstream:android-context`.
- Combined helper: `npm run sync:upstream:all`.
- For upstream downsync/review operations, use repository skill `.skills/upstream-downsync/` and require explicit user approval after plan output before mutating repo-tracked files.
- State files:
  - `tools/upstream/state/smarttwitchtv-head.sha`
  - `tools/upstream/state/smarttwitchtv-release-tree.sha`
- Local-only Android context folder (ignored): `.ai_context/android_upstream/latest/`.

## Build, Package, Deploy
- Install deps: `npm install`
- Lint/check JS pipeline: `npm run lint`
- Prepare staged hosted artifact: `npm run hosted:prepare`
- Build IPK: `npm run webos:package`
- Install on device: `npm run webos:install`
- Launch app: `npm run webos:launch`
- Inspect app: `npm run webos:inspect`
- Remove app: `npm run webos:remove`

## Quality Gate
- For every functional change in wrapper/bridge:
  - Run `npm run lint`
  - Run `npm run webos:package`
- Keep changes small and isolated.
- Prefer explicit helper functions over duplicated inline logic.

## webOS Best Practices
- Use `disableBackHistoryAPI` in `appinfo.json`.
- Handle app visibility/lifecycle with `visibilitychange` and `webkitvisibilitychange`.
- Route app close/back through `webOS.platformBack()` / `PalmSystem.platformBack()`.
- Treat Android-only features (APK update flow, Android services) as compatibility shims on webOS.

## Legal and Copyright
- Keep original headers/licenses on copied upstream or third-party files.
- Add new attribution only for newly created files/sections owned by this fork.
- Do not remove required upstream license/copyright notices.

## Canonical Documentation Map
- `README.md`: project entrypoint + fork context + preserved upstream historical section.
- `docs/UPSTREAM_SYNC_PLAYBOOK.md`: upstream sync procedure.
- `docs/WEBOS_DEPLOYMENT.md`: build/package/deploy/release operations.
- `docs/WEBOS_PORTING_STATUS.md`: current implementation status and parity snapshot.
- `docs/WEBOS_LIMITATIONS.md`: platform limits and non-1:1 transfers.
- `docs/AI_DOCUMENTATION.md`: AI-oriented architecture/runtime summary and references.
- Deep references:
  - `docs/ANDROID_TO_WEBOS_FLOW_MAPPING.md`
  - `docs/WEBOS_BRIDGE_PERFORMANCE_AUDIT.md`
