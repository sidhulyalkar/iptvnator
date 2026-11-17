# IPTVnator Fire tablet APK: isolated preview

**State:** source-only Android preview based on the draft PR #17 frontend. This is not a production-approved release. The Android CI APK must build and pass real-device acceptance before calling this installable or playback-ready.

## Architecture

- `apps/android/` is a small Java/Gradle Android Activity and AndroidX WebKit `WebViewAssetLoader`.
- `web:build:android` produces the actual Angular frontend in `dist/apps/web`, rooted at `/assets/`, with Angular service-worker files disabled. Gradle embeds these build assets directly. No remote URL, Electron preload or Google Play Services is needed for the **shell**.
- The private origin `https://appassets.androidplatform.net/assets/` is intercepted. Launch and extensionless Angular navigation routes return `index.html` **before** `WebViewAssetLoader` handles the URL (its normal missing-asset response is a non-null 404). Missing JS/CSS/font files fail closed, and external main-frame HTTP(S) navigation leaves the app for the tablet browser.
- Native file chooser uses Android's document picker, so the browser application's existing M3U upload control can select local files. DOM storage / IndexedDB are enabled. Android back navigates WebView history; custom fullscreen is supported.
- Unique app ID: `dev.sidhulyalkar.iptvnator.preview`, not upstream IPTVnator. Minimum Android API 28 (Fire OS 7+). Fire OS 6, obsolete WebViews and specific device codecs are unqualified.
- Android WebView is **not Electron**: no Electron IPC, native MPV, guaranteed header injection, CORS bypass, or guaranteed HLS/DRM support. The bundled Angular web player and configured backend still own networking. No authorization to play a commercial provider is implied.
- Cleartext traffic is permitted at the Android manifest level for authorized legacy HTTP endpoints, but WebView retains compatibility-mode mixed-content blocking. An HTTP stream can still fail; do not weaken this policy globally without a scoped threat review and a device test.

## Build locally

From the repo root, install the exact Node/pnpm versions and dependencies from `.nvmrc` and `package.json`, plus JDK 17, Android SDK 35/build-tools 35.0.0, Gradle 8.11.1.

```bash
pnpm install --frozen-lockfile
node --test tools/android/verify-android-bundle.test.mjs
pnpm nx build web --configuration=android
node tools/android/verify-android-bundle.mjs
# Native routing tests include launch, deep links, missing assets and invalid requests.
gradle -p apps/android :app:assembleDebug :app:lintDebug :app:testDebugUnitTest
```

Result (when all commands succeed): `apps/android/app/build/outputs/apk/debug/app-debug.apk`. This is a **debug-signed** preview, not a production/distribution signed artifact.

## Get an APK through GitHub Actions

The branch includes `.github/workflows/fork-fire-tablet-apk.yml`. Connected API commits may not fire workflow events. A workflow-dispatch button may not be available until the workflow is on the default branch. **The easiest build trigger is to use GitHub in your browser**:

1. Sign in to GitHub and open [the build-request file](https://github.com/sidhulyalkar/iptvnator/blob/feature/fire-tablet-android-preview-20261117/tools/android/preview-build-request.txt).
2. Click the pencil (**Edit this file**), change the request number from `0` to `1` (or increment it again on later builds), and choose **Commit changes** directly to `feature/fire-tablet-android-preview-20261117`. Do not make a new branch.
3. Open [the GitHub Actions run list](https://github.com/sidhulyalkar/iptvnator/actions) and select **Fork Fire tablet APK preview**. No APK exists until that job succeeds.

Alternatively, from your local checkout, push a new branch commit with your own GitHub account:

```bash
git fetch origin
git switch feature/fire-tablet-android-preview-20261117 || \
  git switch --track origin/feature/fire-tablet-android-preview-20261117
printf 'request=1\n' > tools/android/preview-build-request.txt
git add tools/android/preview-build-request.txt
git commit -m "ci: request Fire tablet preview APK"
git push origin HEAD
```

Open [GitHub Actions](https://github.com/sidhulyalkar/iptvnator/actions) and inspect **Fork Fire tablet APK preview** for the exact commit. **Only if its build job passes**, download the `iptvnator-fire-tablet-preview-<sha>` Actions artifact ZIP. Extract the enclosed `.apk` and `.sha256`. Verify the SHA-256 against the APK. The job uploads only test artifacts, no release or store publishing.

**Important:** GitHub debug signing keys are ephemeral between runners. Future APKs may require uninstalling the previous preview, which deletes its locally stored playlists and Favorites. Use non-sensitive fixtures initially and export data before reinstall. A stable private signing identity, retained outside Git, is required before normal in-place update testing.

## Install on Fire tablet

1. On the tablet, open **Settings → Security & Privacy → Install unknown apps**, then temporarily allow the app used to open the APK (for example Silk or Files). Menu names vary with Fire OS.
2. Transfer the verified APK by USB or download it from your authenticated GitHub Actions artifact; open it in Files/Downloads and choose **Install**.
3. Open **IPTVnator Fire Preview**. It runs as a separate app from an installed browser PWA.

ADB alternative after enabling developer options and USB debugging:

```bash
adb devices
adb install -r IPTVnator-Fire-Preview-<sha>.apk
adb shell am start -n dev.sidhulyalkar.iptvnator.preview/.MainActivity
```

On a signature mismatch, `adb install -r` fails instead of silently replacing an unrelated app. Do not uninstall to work around it until you have exported local test data.

## Acceptance checklist, not yet run on actual Fire hardware

- [ ] CI exact commit: Java compile, Gradle lint/tests, APK signature, package ID, bundled `index.html` and hashed JS, verified SHA-256
- [ ] Clean install and relaunch on the user's Fire tablet; report model, Fire OS version and WebView version
- [ ] Initial app load while offline; no remote Vercel login or missing JS chunks
- [ ] Local M3U upload through document picker; groups, Guide, search, Favorites survive force-close/reopen
- [ ] Synthetic broken channel reports an error instead of leaving a frozen player
- [ ] Authorized HTTPS HLS and MPEG-TS stream testing, switching 20 times, playback fullscreen, seek, pause/resume and screen rotation
- [ ] Authorized HTTP playlist/streams where permitted, record mixed-content/CORS errors without bypassing device policy
- [ ] Portal authorization, redirect, cookies, license/DRM and credential scoping tested per provider, without putting secrets into logs/screenshots
- [ ] Back button, software keyboard, touch targets, tablet portrait/landscape, memory pressure, WebView crash recovery, battery/thermals
- [ ] Stable private signing key setup before incremental updates and public release decision

The existing desktop candidate [PR #17](https://github.com/sidhulyalkar/iptvnator/pull/17) remains draft, unchanged. This Android PR must remain draft and must not be merged, tagged, or deployed as a public release on initial source-only evidence.
