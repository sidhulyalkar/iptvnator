# Test IPTVnator Unified TV yourself

**Candidate:** draft [PR #17](https://github.com/sidhulyalkar/iptvnator/pull/17). **State as of 2026-11-17:** browser PWA deployable; unsigned Linux x64 preview installer built and verified; Windows and macOS installers awaiting native GitHub Actions build. Do not treat this as a signed public release.

## Fastest path: install the browser app

- [Current candidate PWA](https://iptvnator-ui-review-laewpo48d-sidsoccer21-6129s-projects.vercel.app) (Git commit `030d79a`). Sign in to Vercel if prompted.
- On Windows, open the PWA in **Microsoft Edge**, then **… → Apps → Install this site as an app**. Chrome also offers **Install IPTVnator** from the address bar/menu. Firefox desktop does not offer an equivalent native PWA installation path.
- To inspect **Find → Decide → Keep**, use the [three-screen tour](https://iptvnator-unified-tv-tour-8r6sxy5pp-sidsoccer21-6129s-projects.vercel.app/iptvnator/unified-tv-candidate/). The screenshots predate this candidate and are labelled as such.
- [Synthetic lineup](https://github.com/sidhulyalkar/iptvnator/blob/030d79aaff7f496607b10de20deb3f5a808f4bab/tools/unified-tv/fixtures/lineup.m3u) contains five fictional channels with deliberately invalid stream hosts. Use **Raw → Save As** to import it as a local M3U for UI search, group filtering, Favorites, and error-state exploration. It is **not a playback test**.

The PWA cannot validate native Electron, embedded MPV, or Electron-only authentication headers. For real playback use only a source you are authorized to access and do not paste private credentials into screenshots/reports.

## Download unsigned desktop installers through GitHub Actions

The branch contains the read-only [Fork preview installers](https://github.com/sidhulyalkar/iptvnator/blob/qualify/unified-tv-end-to-end-p0-20261104/.github/workflows/fork-preview-installers.yml) workflow. It produces **Windows x64 NSIS EXE and portable ZIP**, **macOS Apple Silicon ZIP**, and **Linux x64 DEB**, all under the isolated `IPTVnator Preview` identity. These do not overwrite upstream IPTVnator and never publish to the upstream repository.

**If no Actions run exists**, GitHub may have suppressed the automated event from API-authored commits. Push one real file change using your own GitHub login to trigger the branch-scoped `push` workflow:

```bash
git fetch origin
git switch qualify/unified-tv-end-to-end-p0-20261104 || \
  git switch --track origin/qualify/unified-tv-end-to-end-p0-20261104

date -u +'%Y-%m-%dT%H:%M:%SZ' > tools/packaging/preview-build-request.txt
git add tools/packaging/preview-build-request.txt
git commit -m "ci: request unsigned preview installers"
git push origin HEAD
```

Then open [GitHub Actions](https://github.com/sidhulyalkar/iptvnator/actions), select **Fork preview installers (unsigned, artifact only)** and open the run for **your new commit**. It should contain `installer-contracts`, `windows-x64`, `macos-arm64`, and `linux-x64`. An Actions artifact appears only after its job succeeds. Scroll to **Artifacts**, download the zip for your OS, then extract that zip.

If Actions are disabled for the repository, enable them in the repository's Actions settings before pushing. If the run fails, share the **failed job and log**, not any tokens or playlist credentials. Do not infer installability from a missing artifact.

### Windows 64-bit

From the downloaded `iptvnator-preview-windows-x64-<commit>.zip`, extract and run the `IPTVnator-Preview-0.25.0-windows-x64-setup.exe` installer. The adjacent portable ZIP is an alternative if generated. This build is **unsigned**, so Windows SmartScreen may show a warning. Verify the source run and the provided `.sha256` first. Do not bypass security controls for an unfamiliar binary.

### macOS Apple Silicon

Extract the `iptvnator-preview-macos-arm64-<commit>.zip` Actions artifact and the enclosed application ZIP. Copy the app into Applications. It is an unsigned, **not notarized** test build; macOS Gatekeeper may restrict running it. The preview intentionally has no embedded MPV runtime.

### Linux x64

Extract the `iptvnator-preview-linux-x64-<commit>.zip` Actions artifact and verify the included hash. Install the enclosed DEB:

```bash
sha256sum -c IPTVnator-Preview-0.25.0-linux-amd64.deb.sha256
sudo apt install ./IPTVnator-Preview-0.25.0-linux-amd64.deb
```

The Linux DEB independently built in a Linux x64 sandbox on 2026-11-17 had size **137,728,428 bytes**, SHA-256 `eca77a87c504c8d6c010aa382288f8aefd98fe8c6b331078a5f6f1a9dcdf10be`, and passed ASAR, package ID, declared native dependency and checksum verification. Its system package installation also succeeded. Different build runs can legitimately yield a different hash; verify against the artifact from **the same run**, not this historical digest.

## A ten-minute acceptance walkthrough

1. **Find:** import the fictional sample lineup; search for *World Football* and *Discovery Lab*; verify group filters and keyboard focus.
2. **Decide:** inspect the guide and current/next program presentation. If you load a synthetic guide, check timeline synchronization; the bundled lineup alone contains no EPG.
3. **Keep:** Favorite two channels, navigate away, return to the Favorites collection, and remove one. Verify state survives a restart.
4. **Playback:** with an authorized working stream, play, pause, switch repeatedly, close, reopen, and confirm the previous stream's credentials do not contaminate the new one. This final step requires desktop Electron for native header-scoping verification.
5. **Failure states:** deliberately try a channel from the synthetic lineup, which must report an understandable error instead of silently freezing.

Capture the operating system, preview artifact/run commit, what you clicked, expected behavior, observed behavior, and a screenshot with credentials redacted.

## Release boundary

PR #17 remains **draft**. Browser builds and targeted tests passed, but **Windows and macOS install and native playback are not yet independently verified**. Do not merge, tag, publish, or enable auto-updates from these preview artifacts. Unreviewed native code, unsigned installers, provider-specific compatibility, and platform security gates remain release blockers.
