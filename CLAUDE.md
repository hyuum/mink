# Notes for working on Matcha Planner

- Every change that ships in an app update gets a line in `src/app/changelog.ts`: add a new entry with the next
  `id` (newest first) or extend today's entry. The app shows unseen entries once after updating ("What's new").
  Write them in plain words, from the user's side.
- Check before pushing: `npx tsc --noEmit -p .`, `npm test`, `npm run build`.
- The Android APK is built by GitHub Actions on push and published to the `android-latest` release.
