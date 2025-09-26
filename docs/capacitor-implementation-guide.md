# Capacitor Implementation Guide

Single place to track progress and reference best practices while adding Capacitor support to the Quasar app. Steps are grouped into phases and expressed as checklists so you can mark progress (`[ ]` → `[x]`). Keep web bundles clean by only loading native code through wrappers guarded by `process.env.MODE === 'capacitor'` and dynamic imports. This document is opinionated to keep the web build pristine and the native build predictable.

---

## Legend
- `[ ]` not started
- `[/]` in progress or partially complete
- `[x]` finished / verified

---

## Goals & Scope

- Run the existing Quasar/Vite SPA as a high‑quality iOS and Android app using Capacitor.
- Keep the web bundle free of native SDKs and heavy plugin code via wrapper modules and dynamic imports.
- Provide a consistent, typed API for native features (push, purchases, deep links, files, camera, browser, lifecycle).
- Support feature flags and environment scoping for dev, test, and store builds.
- Document platform‑specific steps, review requirements, and CI automation.

---

## Table of Contents

- Phase 0 · Repo Prep & Tooling
- Phase 1 · Enable Capacitor Mode
- Phase 2 · Platform Helpers & Wrapper Contracts
- Phase 3 · Push Notifications
- Phase 4 · In‑App Purchases (IAP)
- Phase 5 · Deep Links & App Links
- Phase 6 · Files, Camera, Share & Browser
- Phase 7 · App Lifecycle, Back Button, UI Chrome
- Phase 8 · Configuration, Envs & Build Targets
- Phase 9 · QA, Testing & Automation
- Phase 10 · Release Checklist
- Appendices · Examples, Conventions, Troubleshooting, Security

---

## Phase 0 · Repo Prep & Tooling

| Step | Notes |
| --- | --- |
| [ ] Install/update Xcode (iOS) and Android Studio + SDK Manager | Required for native builds, simulators, entitlements. Keep both on stable channels. |
| [ ] Install CocoaPods (`brew install cocoapods`) | iOS dependency manager used by Capacitor plugins. Run `pod setup` once. |
| [ ] Install JDK 17 (Zulu/Temurin) and set `JAVA_HOME` | Android Gradle requires LTS JDK; avoid newer JDKs unless plugin set supports. |
| [ ] Install Android SDK components (SDK 34+, build‑tools 34.x, platform tools) | Use Android Studio SDK Manager; confirm `ANDROID_HOME` and `ANDROID_SDK_ROOT`. |
| [ ] Verify Node 22, Quasar CLI ≥ 2, `@quasar/app-vite` aligned with project | Use `nvm use` and `quasar -v`. |
| [ ] Install global Capacitor CLI (`npm i -g @capacitor/cli`) | Optional but convenient for native tweaks. |
| [ ] Install `@capacitor/assets` globally (optional) | For generating icons/splash from a single source image. |
| [ ] Snapshot current `package-lock.json` / `pnpm-lock.yaml` | Helps diff when plugins are added. |
| [ ] Ensure Git LFS if storing large assets | Avoid bloating repo with large binaries. |

Key environment variables

- `JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home`
- `ANDROID_HOME=~/Library/Android/sdk`
- `ANDROID_SDK_ROOT=$ANDROID_HOME`

---

## Phase 1 · Enable Capacitor Mode

| Step | Output |
| --- | --- |
| [ ] `quasar mode add capacitor` | Generates `src-capacitor`, updates scripts, prompts for bundle ID (e.g., `art.fiddl.app`). |
| [ ] Commit generated scaffolding (`src-capacitor`, `capacitor.config.ts`) | Keep pristine state for later diffs. |
| [ ] Create env files: `.env.capacitor`, `.env.capacitor.ios`, `.env.capacitor.android` | Seed with `VITE_DISTRIBUTION=store`, `VITE_CAP_APP_ID=art.fiddl.app`, etc. |
| [ ] Add `capacitor.config.ts` base settings | See suggested config below. |
| [ ] Document native build folders in README (`ios/App`, `android/app`) | Orient contributors. |
| [ ] Run once: `quasar dev -m capacitor -T ios`, then `-T android` | Generates native projects, ensures baseline build passes. |

Suggested `capacitor.config.ts` baseline

```ts
import { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: process.env.VITE_CAP_APP_ID || 'art.fiddl.app',
  appName: 'Fiddl',
  webDir: 'dist/capacitor',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0 },
    // add plugin‑specific config in later phases
  },
}

export default config
```

Quasar build integration

- Ensure `quasar.config.ts` sets a distinct output folder when `mode === 'capacitor'` (e.g., `dist/capacitor`).
- Exclude `@capacitor/*` and native SDKs from web build via dynamic imports only (never static imports in non‑capacitor code paths).

---

## Phase 2 · Platform Helpers & Wrapper Contracts

Goal: Avoid shipping Capacitor code in web bundles. All native features live behind wrappers with dynamic imports.

Folder structure (suggested)

```
src/
  lib/
    platform.ts         // env + runtime helpers
    native/
      index.ts          // central re‑export surface
      push.ts           // web/no‑op default
      push.capacitor.ts // native implementation
      purchases.ts
      purchases.capacitor.ts
      deeplinks.ts
      deeplinks.capacitor.ts
      browser.ts
      browser.capacitor.ts
      files.ts
      files.capacitor.ts
      camera.ts
      camera.capacitor.ts
```

`src/lib/platform.ts` example

```ts
import { Platform } from 'quasar'

export const isCapacitor = () => process.env.MODE === 'capacitor'
export const isIOS = () => isCapacitor() && Platform.is.ios
export const isAndroid = () => isCapacitor() && Platform.is.android
export const isStoreBuild = () => isCapacitor() && import.meta.env.VITE_DISTRIBUTION === 'store'

export type NativeResult<T> = { ok: true; value: T } | { ok: false; error: string; code?: string }
```

Wrapper contract guidelines

- Default (web) exports are safe no‑ops that resolve quickly and never throw.
- Capacitor variants are loaded via dynamic import inside functions, not top‑level `import`.
- Normalize errors to `{ ok: false, error, code }` so UI code can handle consistently.
- Do not leak plugin types outside wrappers; export your own typed interfaces.
- Provide `supportsX()` helpers to allow feature‑gated UI.

Dynamic import pattern

```ts
// push.ts (web)
import { isCapacitor } from '../platform'
export async function registerPush() { return { ok: false as const, error: 'not_supported' } }

// push.capacitor.ts (native)
import { PushNotifications } from '@capacitor/push-notifications'
import { isCapacitor } from '../platform'
export async function registerPush() {
  if (!isCapacitor()) return { ok: false as const, error: 'not_supported' }
  const perm = await PushNotifications.checkPermissions()
  if (perm.receive !== 'granted') {
    const req = await PushNotifications.requestPermissions()
    if (req.receive !== 'granted') return { ok: false as const, error: 'denied' }
  }
  await PushNotifications.register()
  // attach listeners etc. return token
  return { ok: true as const, value: /* token */ '' }
}
```

Central surface `src/lib/native/index.ts`

```ts
export * as Push from './push'
export * as Purchases from './purchases'
export * as Deeplinks from './deeplinks'
export * as Browser from './browser'
export * as Files from './files'
export * as Camera from './camera'
```

---

## Phase 3 · Push Notifications

| Step | Notes |
| --- | --- |
| [ ] Install core plugins: `npm i @capacitor/push-notifications @capacitor/device @capacitor/app` | Device + App used for token metadata and lifecycle. |
| [ ] Choose FCM bridge for Android (or multi‑platform) | Recommended: `@capacitor-firebase/messaging`. OneSignal is an alternative if you prefer managed push. |
| [ ] iOS provisioning: enable Push capability; create Key ID, Team ID, `.p8` for APNs | Needed before device testing. Store credentials securely. |
| [ ] Firebase: create iOS and Android apps; download `GoogleService-Info.plist` and `google-services.json` | Required for FCM tokens if using Firebase bridge. |
| [ ] Android Gradle: apply Google Services plugin | Add `classpath 'com.google.gms:google-services:...` in `build.gradle` and `apply plugin: 'com.google.gms.google-services'` in `android/app/build.gradle`. |
| [ ] iOS Pod install: `cd ios/App && pod install` | Ensures Firebase pods are integrated. |
| [ ] Implement `registerPush` in wrapper; persist token on server | Send `{ token, platform, appVersion, deviceModel }`. Handle refresh. |
| [ ] Add opt‑in UI with clear copy | Respect user choice; provide toggle to unsubscribe. |
| [ ] Configure Info.plist and Android permissions | iOS: nothing explicit for push; Android 13+: `POST_NOTIFICATIONS`. |
| [ ] Create Android notification channels | At app start, create a default channel and any high‑priority channels. |
| [ ] Handle push open → navigation | Use `App.addListener('appUrlOpen', ...)` or push listener to route. |

Server integration

- Store tokens keyed by user + device; update on refresh; expire on logout.
- Provide an endpoint to register/unregister; include opt‑in state.
- Consider backend fan‑out via FCM/APNs or use OneSignal/Expo if you prefer a managed bridge.

Common gotchas

- Android 13+ requires `POST_NOTIFICATIONS` runtime permission; show prompt before registering.
- iOS simulators do not receive push; test on device.
- Token types differ (APNs vs FCM); unify on server side or prefer FCM tokens with Firebase bridge.

---

## Phase 4 · In‑App Purchases & Points Credit

| Step | Notes |
| --- | --- |
| [ ] Choose provider (Recommended: RevenueCat) | Simplifies receipts, cross‑platform and sandbox noise. |
| [ ] Install plugin for native builds only | `npm i @revenuecat/purchases-capacitor` (do not import in web paths). |
| [ ] Define product catalog | Map existing points packages → Store consumables (e.g., `points_500`). Keep SKUs stable. |
| [ ] Configure stores | App Store Connect: In‑App Purchases; Play Console: In‑app products. Create sandbox test users. |
| [ ] Backend endpoint `/iap/validate` | Validate receipt (or RevenueCat webhook) and credit points idempotently. |
| [ ] Implement wrappers: `initPurchases`, `fetchOfferings`, `purchasePackage`, `restore` | Normalize errors; return `{ ok, value|error }`. |
| [ ] Add Pinia store `usePurchasesStore` | Centralize offerings, purchase state, refresh user points after success. |
| [ ] Update `src/pages/AddPointsPage.vue` | Use `isStoreBuild()` to hide non‑compliant payment methods; inject IAP UI; wire restore. |
| [ ] App Review checks | Only use IAP for digital content; avoid external payment links in the same flow. |

RevenueCat specifics

- Create app in RevenueCat; obtain public SDK keys per platform.
- Use separate projects/keys for `dev` vs `prod` to isolate sandboxes.
- Optionally consume RevenueCat webhooks to credit points on the backend instead of client‑polled validation.

Testing IAP

- iOS: TestFlight + Sandbox Apple IDs; use StoreKit configuration for local dev if needed.
- Android: Internal testing track + License test accounts; allow up to several hours for product propagation.

---

## Phase 5 · Deep Links & App Links

| Step | Notes |
| --- | --- |
| [ ] Decide linking scheme | Prefer universal links/app links over custom schemes for a seamless UX. |
| [ ] iOS: Associated Domains | Enable capability; add `applinks:your.domain`. Deploy `/.well-known/apple-app-site-association`. |
| [ ] Android: Intent filters | Add `<intent-filter>` with `<data android:host="your.domain" android:pathPrefix="/">` and publish `/.well-known/assetlinks.json`. |
| [ ] Capacitor handling | Use `App.addListener('appUrlOpen', handler)` to translate incoming URLs to SPA routes. |
| [ ] Web fallback | Ensure the same URLs are valid on web and route identically. |

Handler example

```ts
import { App } from '@capacitor/app'
App.addListener('appUrlOpen', ({ url }) => {
  // map https://your.domain/path?x=y → router.push('/path?x=y')
})
```

---

## Phase 6 · Files, Camera, Share & Browser

| Step | Notes |
| --- | --- |
| [ ] Filesystem | Use `@capacitor/filesystem` for persistent/cached data. Document paths and quotas. |
| [ ] Camera | Use `@capacitor/camera`; request permissions; include iOS usage strings. |
| [ ] Share | Use `@capacitor/share` to invoke native share sheets. |
| [ ] Browser | Use `@capacitor/browser` for external URLs rather than `window.open`. |

Permissions & Info.plist keys (examples)

- `NSCameraUsageDescription`: "Allow Fiddl to capture photos"
- `NSPhotoLibraryAddUsageDescription`: "Save images to your library"
- `NSPhotoLibraryUsageDescription` when reading library

Android manifest (examples)

- Add `<uses-permission android:name="android.permission.CAMERA" />` as needed.
- Declare `android:exported` on activities for SDK 31+.

---

## Phase 7 · App Lifecycle, Back Button, UI Chrome

| Step | Notes |
| --- | --- |
| [ ] Lifecycle | Use `App.addListener('appStateChange', ...)` to pause/resume services (timers, sockets). |
| [ ] Back button | On Android, intercept hardware back with `App.addListener('backButton', ...)` and route appropriately. |
| [ ] Status bar | Use `@capacitor/status-bar` to set style per page/background. |
| [ ] Splash screen | Configure `@capacitor/splash-screen` (duration 0 or controlled fade). |
| [ ] Keep awake (optional) | Use `@capacitor-community/keep-awake` for long‑running sessions. |

Back button guideline

- If at a root route, double‑press to exit pattern; otherwise, `router.back()`. Avoid closing modals unexpectedly.

---

## Phase 8 · Configuration, Envs & Build Targets

Environment matrix (examples)

| Mode | File | Notes |
| --- | --- | --- |
| Web dev | `.env.development` | Default Vite/Quasar envs. |
| Web prod | `.env.production` | Web deployment. |
| Cap dev | `.env.capacitor` | Shared across iOS/Android dev. |
| Cap iOS | `.env.capacitor.ios` | iOS‑specific overrides. |
| Cap Android | `.env.capacitor.android` | Android‑specific overrides. |

Recommended variables

- `VITE_DISTRIBUTION=store|internal|dev`
- `VITE_CAP_APP_ID=art.fiddl.app`
- `VITE_API_BASE=...`
- `VITE_SENTRY_DSN=...` (only used inside capacitor wrappers)

Build commands (examples)

- iOS dev: `quasar dev -m capacitor -T ios`
- Android dev: `quasar dev -m capacitor -T android`
- iOS release: `quasar build -m capacitor -T ios && (cd ios/App && xcodebuild ...)`
- Android release: `quasar build -m capacitor -T android && (cd android && ./gradlew assembleRelease)`

Quasar config tips

- Use `chainWebpack`/`vitePlugins` to tree‑shake capacitor code from web builds.
- Guard any SDK initializers with `if (process.env.MODE === 'capacitor')`.

---

## Phase 9 · QA, Testing & Automation

| Step | Notes |
| --- | --- |
| [ ] Draft manual test scripts covering login, capture, push opt‑in/out, purchases, deep links, offline flows | Include pass/fail checklist and expected screenshots. |
| [ ] Device matrix | iOS: latest + previous major; Android: SDK 26–34, a few OEM skins. |
| [ ] E2E smoke tests (optional) | Detox or Appium for critical flows. |
| [ ] Verify web build (`quasar build`) remains free of capacitor‑only chunks | Inspect `dist` and source maps; watch bundle size. |
| [ ] Crash/analytics | Initialize Sentry/Crashlytics inside wrappers only when `isCapacitor()`. |
| [ ] CI jobs | Fastlane for iOS, Gradle for Android, cache `node_modules`, `Pods`, and Gradle. |

Continuous Delivery tips

- Separate pipelines for web vs. native. Native builds are slower and require signing secrets.
- Use Fastlane Match or manual profiles; never commit signing keys to repo.

---

## Phase 10 · Release Checklist

| Step | Notes |
| --- | --- |
| [ ] Store listings | Screenshots, privacy, age rating, localized descriptions. |
| [ ] App Privacy (iOS) | Fill data collection and tracking statements accurately. |
| [ ] Data safety (Play) | Declare data collection/usage categories. |
| [ ] IAP product review | Connect products to the submitted binary; provide demo account/video. |
| [ ] Versioning | Keep `CFBundleShortVersionString` / `CFBundleVersion` (iOS) and `versionName` / `versionCode` (Android) aligned with repo tags. |
| [ ] Signing | iOS: provisioning profiles and certificates; Android: upload keystore secure storage. |
| [ ] Post‑launch validation | Reconcile purchases vs. backend; monitor crashes and ANRs; watch retention. |
| [ ] Post‑launch retro | Document issues, update this guide with lessons learned. |

---

## Appendices

### A. Example wrapper: Purchases (RevenueCat)

```ts
// purchases.ts (web)
export async function initPurchases() { return { ok: false as const, error: 'not_supported' } }
export async function fetchOfferings() { return { ok: false as const, error: 'not_supported' } }
export async function purchasePackage(id: string) { return { ok: false as const, error: 'not_supported' } }
export async function restore() { return { ok: false as const, error: 'not_supported' } }

// purchases.capacitor.ts (native)
import { Purchases } from '@revenuecat/purchases-capacitor'
export async function initPurchases(apiKey: string, appUserId?: string) {
  await Purchases.configure({ apiKey, appUserId })
  return { ok: true as const, value: true }
}
```

### B. iOS configuration checklist

- Enable capabilities: Push Notifications, Associated Domains (for universal links), Background Modes (remote-notification if needed).
- Info.plist keys: camera/photo usage strings, any URL schemes, LSApplicationQueriesSchemes if required.
- Cocoapods: run `pod repo update` when plugins add pods.
- Set deployment target aligned with Capacitor major (iOS 13+ typically, check release notes).

### C. Android configuration checklist

- Compile SDK and target SDK 34+; minSdk per plugin requirements (often 23+).
- `android/app/build.gradle`: apply `com.google.gms.google-services` if using Firebase.
- Add notification channels on startup.
- Verify manifest merges for permissions; avoid duplicates and set `android:exported`.

### D. Security & secrets

- Never commit `.p8`, keystores, or service JSON/Plists to the repo. Use CI secrets and runtime injection.
- Consider encrypting keystores at rest and using Fastlane Match or similar for iOS.
- Scope API keys to mobile origins only when possible; rotate on compromise.

### E. Troubleshooting

- iOS build fails after plugin install → run `cd ios/App && pod install --repo-update`.
- Android build complaining about Kotlin/Gradle versions → align to plugin release notes, update `gradle-wrapper.properties`.
- Push not received on Android 13+ → ensure `POST_NOTIFICATIONS` runtime permission requested before `register()`.
- Missing universal link routing → verify `apple-app-site-association` and `assetlinks.json` content and HTTPS hosting without redirects.

### F. Resources

- Quasar Capacitor docs: https://v2.quasar.dev/quasar-cli-vite/developing-capacitor-apps
- Capacitor official docs: https://capacitorjs.com/docs
- RevenueCat Capacitor guide: https://www.revenuecat.com/docs/capacitor
- Apple App Store Review Guidelines §§ 3.1.1 (In‑App Purchases), 5.1 (Data collection)
- Google Play Payments policy: https://support.google.com/googleplay/android-developer/answer/9858738

Keep this guide evolving. As new native features are added (biometrics, background tasks, in‑app review, haptics), create new wrapper pairs and document platform steps here.

