# Notes for working on Matcha Planner

- Every change that ships in an app update gets a line in `src/app/changelog.ts`: add a new entry with the next
  `id` (newest first). The app shows unseen entries once after updating ("App update"). Keep each line
  extremely short: "New: notification history", "Fix: blocks couldn't run past midnight", "Change: …".
- Check before pushing: `npx tsc --noEmit -p .`, `npm test`, `npm run build`.
- The Android APK is built by GitHub Actions on push and published to the `android-latest` release.
