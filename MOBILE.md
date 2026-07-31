# Zen — mobile (Capacitor)

Zen wraps the same Vite web build in native Android and iOS shells.

**App ID:** `com.decot01.zen`

## Prerequisites

- Node 22+
- **Android:** [Android Studio](https://developer.android.com/studio) (SDK + device/emulator)
- **iOS:** macOS + Xcode 15+ (cannot build IPA on Windows)

## Everyday workflow

```bash
npm install
npm run cap:sync          # build web → copy into android/ + ios/
npm run cap:android       # sync + open Android Studio
npm run cap:ios           # sync + open Xcode (Mac only)
```

After any web/game change, run `npm run cap:sync` before testing native.

### Icons / splash

Source files live in `assets/` (`icon.png`, `splash.png`). Regenerate:

```bash
node scripts/generate-mobile-assets.mjs
npm run assets
```

## Android (Windows OK)

1. Install Android Studio and open the `android/` folder (`npm run cap:android`).
2. Wait for Gradle sync.
3. Pick an emulator or USB device → **Run**.
4. Debug APK: **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
   Output: `android/app/build/outputs/apk/debug/app-debug.apk`

Or from the repo root:

```bash
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

Release / Play Store needs a keystore and a signed release build (not covered here).

## iOS (Mac required)

1. On a Mac: `npm run cap:ios`.
2. In Xcode select a simulator or device → **Run**.
3. For App Store: set signing team, archive, upload via Organizer.

The `ios/` folder can live in git on Windows; only **building** needs macOS.

## Notes

- Scores / settings stay in local storage on device.
- Haptics use Capacitor Haptics on device (`navigator.vibrate` fallback on web).
- Safe-area insets come from CSS `env(safe-area-inset-*)` + StatusBar overlay.
