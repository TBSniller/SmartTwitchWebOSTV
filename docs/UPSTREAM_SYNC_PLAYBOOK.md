# Upstream Sync Playbook (Canonical)

This document is the canonical procedure for upstream synchronization in this fork.

## Canonical Skill-First Flow
- Always use repository skill `.skills/upstream-downsync/` for upstream downsync/review work.
- Keep fork adaptations minimal and limited to wrapper/bridge/tooling/docs surfaces.

## Scope
- Tracked in git: `release/`, `webos/app/`, `webos/bridge/webosCompatBridge.js`, tooling/docs/workflows.
- Local-only (ignored): `.ai_context/android_upstream/latest/`.

## 1) Sync Upstream `release/` Mirror (Tracked)

Run:

```bash
npm run sync:upstream:release
```

Behavior:
1. Clone upstream `fgl27/SmartTwitchTV`.
2. Read upstream `HEAD` SHA and `HEAD:release` tree SHA.
3. Compare upstream `HEAD:release` tree SHA with local `tools/upstream/state/smarttwitchtv-release-tree.sha`.
4. If unchanged: no tracked file changes.
5. If changed:
   - replace tracked `release/`
   - update:
     - `tools/upstream/state/smarttwitchtv-head.sha`
     - `tools/upstream/state/smarttwitchtv-release-tree.sha`
6. Enforce mirror cleanliness:
   - fail if tracked `release/` contains bridge patch artifacts:
     - `release/githubio/js/webosCompatBridge.js`
     - bridge script tag in `release/index.html`

Post-sync checks:
1. Review `release/` diff.
2. Run quality gate:

```bash
npm run lint
npm run webos:package
```

## 2) Sync Android Upstream Context (Local-Only)

Run:

```bash
npm run sync:upstream:android-context
```

Behavior:
1. Clone upstream.
2. Refresh `.ai_context/android_upstream/latest/` excluding `.git/`, `app/`, and `release/`.
3. Write local helper files:
   - `.sync-metadata.json`
   - `.sync-file-index.json`
   - `.sync-diff-report.md`

Notes:
- This context is local-only and not part of release deployment.
- Use `npm run sync:upstream:all` to run release sync + Android context sync sequentially.

## 3) Android-Driven Bridge Review Flow

Use this when upstream Android behavior changes may affect webOS bridge compatibility:
1. Run `npm run sync:upstream:android-context`.
2. Inspect `.ai_context/android_upstream/latest/.sync-diff-report.md`.
3. Map Android behavior changes to:
   - `app/specific/OSInterface.js` usage
   - `window.Android` methods in `webos/bridge/webosCompatBridge.js`
4. Keep adaptations in wrapper/bridge/tooling only.
5. Run `npm run lint` and `npm run webos:package`.
6. Update parity docs when needed:
   - `docs/WEBOS_PORTING_STATUS.md`
   - `docs/WEBOS_LIMITATIONS.md`

## 4) Sync Automation

Workflow: `.github/workflows/sync-upstream-release.yml`
- Triggers: manual, scheduled, and push to `dev/webos-wrapper-cleanup`.
- Runs `npm run sync:upstream:release`.
- Opens PR only when tracked sync outputs changed:
  - `release/`
  - `tools/upstream/state/smarttwitchtv-head.sha`
  - `tools/upstream/state/smarttwitchtv-release-tree.sha`
- Does not sync `.ai_context/android_upstream/` in CI.

## Related Docs
- Build/deploy/release operations: `docs/WEBOS_DEPLOYMENT.md`
- Current parity snapshot: `docs/WEBOS_PORTING_STATUS.md`
- Platform limits rationale: `docs/WEBOS_LIMITATIONS.md`
