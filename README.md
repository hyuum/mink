# Matcha Planner

A cosy, local-first personal planner for your phone: a painted day timesheet, a weekly spending allowance and tasks.
Everything is stored on your device (IndexedDB). There is no account and no server.

## What works in this build

- **Home:** today's time, spending and tasks at a glance, a live timer, this week's stickers, and quick task entry.
- **Time:** three tabs. **Day**: one column for the day, from your wake-up to your bedtime. Drag down the day to select some time, then pick what it was. Blocks are solid and show just their name: drag one to move it, tap it for handles to resize, both in 15-minute steps that stop at the next block. Blocks that touch join with square corners. Travel (any activity set to draw as an arrow) is a grey highlighter arrow down the middle that reaches the next block. Planned blocks still ahead show dashed; hold one and it fills with water, then becomes a logged block. The Plan button in the bottom corner opens "Show full plan" (including skipped blocks) and "Edit plan", with **templates** ("Uni day") that repeat on the weekdays you pick. A + sits in any unlogged gap you can tap to fill. Wake-up and bedtime are tags in the hour column you drag up or down. Swipe the date sideways to change day, or tap it for the week. **Week**: a weekly spread of seven day columns with sleep shaded and dotted lines joining wake-up and bed times; paint straight onto it or tap a day to open it. **Stats**: week and month charts. Timers still work. Week and month summaries by activity, with a Drift total.
- **Money:** one weekly allowance (Monday–Sunday) with money left and a per-day pace. Every spend must be marked need or want; tags are optional. Week view shows need vs want, each day against the pace, and tag totals. Month view is the calendar month against 4 × the weekly allowance, split by week. Recurring bills count toward the week they're paid in.
- **Tasks:** separate lists, #tags, priority (`!` or `!!`), due dates, and groups for Overdue, Today, Next 7 days, Later, No date and Done.
- **Quick add (+):** log spending (keypad, need/want, tags), time or a task from any screen.
- **More:** theme, timeline hours, daily goal, stickers, activities (add, rename, recolour, draw as an arrow, delete and move their time elsewhere), backup and restore, and the example week.

Not built yet (waiting on redesigns): Trackers, Lists (with tags), Journal and a proper More screen.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173, rebuilds on save
npm run build      # writes dist/ (the installable app) and preview/ (single-file preview)
npm test           # logic tests
npm run typecheck
```

To use it on your phone, host `dist/` on any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages) and open it in Safari or Chrome. Then use "Add to Home Screen". It works offline after the first visit.

## Android app (with phone tracking)

The same planner also ships as an Android app, built by GitHub Actions (`.github/workflows/android.yml`) on every push. The newest install file is always `matcha-planner.apk` on the **android-latest** release: https://github.com/hyuum/mink/releases/tag/android-latest

- **Install:** open that link on your phone, download `matcha-planner.apk`, open it and allow your browser to install apps. Later versions install over it as updates.
- **Move your data across:** in the web app, More › Back up my data and copy it; in the Android app, More › Restore from a backup and paste.
- **Phone tracking:** More › Phone tracking › turn on "Suggest blocks from phone use", then allow **Usage access** for Matcha Planner. Stretches of phone use show up on the Day view as dotted blocks; tap one, or "Review" at the top, to approve (as any activity) or dismiss them. Settings: the shortest stretch that counts, how short a break gets joined over, what unlisted apps count as, and an activity (or "Don't count") for each app you used this week. It only reads which app was on screen and when, never what's inside it.
- **Code:** `android/` is the Capacitor project; `PhoneUsagePlugin.java` reads Android's usage stats, `src/lib/phone.ts` is the bridge, `phoneSuggestions` in `src/data/logic.ts` turns sessions into suggestions, and `src/features/time/phone.tsx` has the review sheet and settings.
- **Signing:** every build is signed with `android/app/matcha-release.jks` so updates install over each other. To use your own private key instead, add it to the build through the `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` and `ANDROID_KEY_PASSWORD` environment variables (switching keys means uninstalling once).

## How the code is laid out

```
src/
  data/       types.ts (the data model), store.ts (state + actions + saving),
              persist.ts (IndexedDB with fallbacks), logic.ts (pure summaries, plans, bills, tasks), seed.ts
  lib/        dates.ts, money.ts (cents, keypad rules), id.ts
  features/   home/, time/, money/, tasks/, add/ (quick add), more/
  ui/         kit.tsx (cards, sheet, chips, checkbox, nav, toasts), icons.tsx
  app/        App.tsx (screens), ui-state.ts (route, quick add, toasts, clock)
  styles/     app.css (theme tokens for light and dark, then components)
tests/        logic.test.ts (node:test), smoke.py (Playwright walk-through at phone size)
```

- **Adding a module** (e.g. Trackers): add its types to `AppData`, defaults in `seed.ts`, a `migrate` default in `store.ts`, actions in `store.ts`, pure helpers in `logic.ts`, and a screen under `features/`. Register the screen in `App.tsx` and `ui-state.ts`.
- **Theme:** every colour is a CSS variable at the top of `app.css`. Swapping the palette is one block.
- **Time entries** carry a `source` (`paint`, `timer`, `manual`, `plan`, and `device` reserved for syncing phone activity later). An entry filled in from a plan keeps its `planId`; that plan then counts as done.
- **Plans:** a day shows its weekday's template until it gets its own copy in `planned` (listed in `planDays`), which happens the first time you edit or fill in that day's plan. Template blocks have made-up `tpl:` ids until then.
- **Money** is stored in integer cents. **Days** are local `YYYY-MM-DD` strings and **instants** are epoch milliseconds.
- **Backups:** More › Back up my data gives you a JSON copy. Restore accepts the same JSON.
