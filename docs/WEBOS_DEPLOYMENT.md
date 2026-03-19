# webOS Build, Package, Deploy, and Release (Canonical)

This document is the canonical operations guide for building and releasing this fork.

## Prerequisites
- Node.js installed
- Dependencies installed with `npm install`
- webOS CLI available (`@webos-tools/cli`, includes `ares-*`)
- Configured webOS device profile named `webos` for install/launch/inspect/remove commands

## Local Build and Validation

From repository root:

```bash
npm run hosted:prepare
npm run lint
npm run webos:package
npm run release:artifacts
```

Outputs:
- `build/com.tbsniller.smarttwitchwebostv_<version>_all.ipk`
- `build/com.tbsniller.smarttwitchwebostv.manifest.json`
- `build/com.tbsniller.smarttwitchwebostv.apps-repo.yml`

## Device Operations

```bash
npm run webos:install
npm run webos:launch
npm run webos:inspect
npm run webos:remove
```

## Release Artifacts
- Homebrew metadata template source:
  - `webos/homebrew/packages/com.tbsniller.smarttwitchwebostv.yml`
- Artifact generation script:
  - `npm run release:artifacts`
- Stable manifest URL contract:
  - `https://github.com/TBSniller/SmartTwitchWebOSTV/releases/latest/download/com.tbsniller.smarttwitchwebostv.manifest.json`

## GitHub Release Automation

Workflow: `.github/workflows/release.yml`
- Trigger: tag push matching `v*`
- Enforced gate: tag must match `webos/app/appinfo.json` version (`vX.Y.Z`)
- Pipeline:
  1. `npm ci`
  2. `npm run hosted:prepare`
  3. `npm run lint`
  4. `npm run webos:package`
  5. `npm run release:artifacts`
  6. publish release assets (`*.ipk`, `*.manifest.json`, `*.apps-repo.yml`)

## GitHub Pages Deployment

Workflow: `.github/workflows/deploy-pages.yml`
- Trigger: push to `master` or `dev/pages-publish` + manual dispatch
- Behavior:
  1. check out `origin/master` and stage `/release` via `node tools/upstream/prepareHostedRelease.js --out-dir .pages --channel release`
  2. check out `origin/dev/pages-publish` and stage `/dev` via `node tools/upstream/prepareHostedRelease.js --out-dir .pages --channel dev`
  3. upload `.pages` artifact
  4. deploy via Pages Actions
- Channel contract:
  - Stable hosted app remains `/release/index.html` from `master`
  - Dev hosted app is `/dev/index.html` from `dev/pages-publish`

## Dev Prerelease Automation

Workflow: `.github/workflows/release-dev-prerelease.yml`
- Trigger: manual dispatch from branch `dev/pages-publish`
- Behavior:
  1. discover next global prerelease tag (`dev-N`) from existing tags
  2. run `npm ci`, `npm run hosted:prepare`, and `npm run lint`
  3. build temporary dev app variant at `.tmp/dev-app`:
     - app id: `<stable-id>.dev`
     - app version: `0.0.N`
     - default hosted target: `/dev/index.html`
  4. package dev app IPK
  5. generate prerelease manifest (`tools/release/generatePrereleaseManifest.js`)
  6. publish GitHub prerelease assets (`*.ipk`, `*.manifest.json`)

- Stable release workflow (`.github/workflows/release.yml`) remains unchanged:
  - tag-driven (`v*`)
  - stable app id/version from `webos/app/appinfo.json`
  - stable Homebrew artifacts (`*.manifest.json`, `*.apps-repo.yml`)

## Related Docs
- Upstream sync procedure: `docs/UPSTREAM_SYNC_PLAYBOOK.md`
- Current implementation/parity snapshot: `docs/WEBOS_PORTING_STATUS.md`
- Platform limits: `docs/WEBOS_LIMITATIONS.md`
