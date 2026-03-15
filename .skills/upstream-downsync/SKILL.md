---
name: upstream-downsync
description: Run the canonical upstream downsync workflow for this fork. Use when upstream sync or downsync is requested, upstream changes are detected, or bridge and parity docs must be reviewed against upstream updates. Execute sync, inspect release and Android-context diffs, produce a proposed plan, and require explicit user approval before any repo-tracked edits.
---

# Upstream Downsync

Run the upstream review cycle in a deterministic order so upstream sync stays clean and webOS-specific updates stay minimal.

## Required Workflow

1. Run sync baseline first.
   - Run `npm run sync:upstream:all`.
   - Treat this as mandatory start for every upstream downsync/review request.
2. Inspect change surfaces.
   - Inspect tracked sync outputs:
     - `release/`
     - `tools/upstream/state/smarttwitchtv-head.sha`
     - `tools/upstream/state/smarttwitchtv-release-tree.sha`
   - Inspect local Android context report:
     - `.ai_context/android_upstream/latest/.sync-diff-report.md`
3. Map impact to allowed adaptation surfaces only.
   - `webos/app/index.js`
   - `webos/app/appinfo.json`
   - `webos/bridge/webosCompatBridge.js`
   - `tools/upstream/prepareHostedRelease.js`
   - Parity docs:
     - `docs/WEBOS_PORTING_STATUS.md`
     - `docs/WEBOS_LIMITATIONS.md`
4. Produce a plan before implementation.
   - Use Plan Mode and output a single `<proposed_plan>` block.
   - Cover: upstream findings, minimal required fork changes, validation steps, and assumptions.
5. Gate all mutating work on explicit user approval.
   - Ask for user confirmation after presenting the plan.
   - Do not edit repo-tracked files before the user confirms.
6. Execute minimal changes after approval.
   - Keep upstream `app/` unchanged for webOS fixes.
   - Preserve tracked `release/` as pure upstream mirror.
   - Preserve `window.Android` compatibility expected by `app/specific/OSInterface.js`.

## Validation

- For functional wrapper/bridge changes, run:
  - `npm run lint`
  - `npm run webos:package`
- For docs-only updates, run targeted verification (spell/link/path consistency) and skip packaging unless runtime logic changed.

## Output Expectations

- Summarize what changed upstream.
- State whether bridge or wrapper adaptation is required.
- If no fork adaptation is needed, say so explicitly and avoid extra edits.
- If adaptation is needed, keep diffs focused and explain why each change is required.
