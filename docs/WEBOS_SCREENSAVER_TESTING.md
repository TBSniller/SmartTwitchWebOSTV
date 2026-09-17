# webOS screensaver mitigation: 1.1.1 test plan

Related issue: [#15](https://github.com/TBSniller/SmartTwitchWebOSTV/issues/15).

## Change and limits

The installed app metadata requests `screenSaverProperties.preferredType = 2`.
LG recommends this policy for video apps with additional UI, including chat.
It applies to OLED TVs with webOS TV 5.0 or newer.

This is a mitigation to validate, not a proven fix for indefinite side-by-side
chat visibility. Type 2 gradually dims the OSD area and extends the inactivity
timeout to 30 minutes. With non-fullscreen video, the screensaver can still
start after that timeout. With fullscreen video, LG documents OSD dimming
without starting the screensaver. Verify both layouts on the affected TV.

The bridge's `Android.mKeepScreenOn()` remains a no-op. Its existing
`foreground = always on` comment must not be taken as a guarantee that webOS
keeps chat visible. This change does not implement an Android-style wake lock,
simulate user input, disable OLED protection, or change upstream chat code.
`enablePigScreenSaver` is deliberately left at its default; setting it to
`false` selects a full-screen screensaver rather than disabling protection.

References:
- [LG screensaver guide](https://webostv.developer.lge.com/develop/guides/screensaver)
- [LG appinfo.json reference](https://webostv.developer.lge.com/develop/references/appinfo-json)

## Test-channel rollout

1. Review and merge the change into `dev/publish-pages`, not `master`.
2. Confirm the Pages deployment succeeds for `/dev/index.html`.
3. Run **Build Dev Prerelease** (`release-dev-prerelease.yml`) manually with
   branch **dev/publish-pages** selected.
4. Install the newly produced `.dev` IPK on the TV and fully restart that app.
   A hosted JavaScript update alone cannot update installed `appinfo.json`.

The source app and service release metadata is `1.1.1`. Existing test-channel
numbering stays unchanged: tag `dev-N`, app ID
`com.tbsniller.smarttwitchwebostv.dev`, package version `0.0.N`, and hosted
URL `/dev/index.html`. The dev app generator preserves the screensaver field.
Neither this PR nor its validation workflow publishes a stable release or
creates a `v1.1.1` tag. Stable promotion is a separate decision after TV testing.

## Automated validation

The **Validate webOS Package** PR workflow prepares the hosted artifact, runs
`npm run lint`, runs `node tools/webos/testScreensaverPackaging.js`, and builds
both stable and dev packages without publishing either package. Its dev number
`1` is only a build fixture, not a new prerelease number or installable release.
The metadata regression test also verifies separate dev service names, the
`/dev/` target, and that dev preparation does not modify stable source files.

## On-device validation before stable promotion

- Record TV model, firmware/webOS version, installed dev tag, and layout.
- Compare the existing app and the new test IPK on the same TV and settings.
- Watch a live stream with active side-by-side chat for at least 40 minutes,
  without remote input. Record the first dimming or black area and whether
  video/audio continue. A change from a few minutes to 30 minutes is only a
  partial mitigation, not resolution of the original always-visible request.
- Repeat with chat over a fullscreen video surface. Note the OSD dimming.
- If the chat becomes black, inspect its DOM and ancestor computed styles
  before using the remote: `display`, `visibility`, `opacity`, the `hide`
  class, and whether messages continue arriving. This helps distinguish app
  hiding from platform/compositor behavior.
- Confirm a remote input restores visibility, then check pause/resume,
  background/foreground, normal idle screensaver behavior, and app relaunch.
- Verify that the stable app still launches independently of the `.dev` app.

Do not close #15 solely because the package builds or the first few minutes
look correct. Record the affected-TV results before claiming a complete fix.
