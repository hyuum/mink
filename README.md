# Matcha Planner

A cosy, local-first Android planner for time and money: a painted day timesheet and a weekly spending allowance.
Everything is stored on your phone. There is no account and no server.

## What works in this build

- **Home:** a small **dailies** chip by the greeting (a ring that fills as they get done, and your gems; tap it for the list), time and spending at a glance, and a live timer.
- **Dailies and gems:** each day's dailies pay gems the moment they're done, with a short celebration: review today's phone use (5) and today's spends (5) in the Android app when they're switched on, fill in all of yesterday (10; sleep before wake-up and after bedtime counts), and write today's note (5). Reviews with nothing to review count from 6 pm. Finishing them all pays a bonus of 20, plus 2 for every day of the streak so far (up to +10); the streak is strict, so a missed day starts it again. Gems buy colour themes in More › Store (Sakura, Hojicha, Yuzu, Blueberry, Lavender, Sumi ink, Koi), which recolour the app's main colour, tint and paper in light and dark, and the **Pixel Hearth** skin (200 gems), a cosy pixel-art inn that changes the fonts, icons, corners, panels, blocks and animations as well, and always uses its own colours whatever the light/dark setting. Tap a theme's colours, or "Try it on" for the skin, to see it before buying; trying on ends when you leave the Store.
- **Time:** three tabs. **Day**: one column for the day, from your wake-up to your bedtime. A plain swipe anywhere on the day scrolls it. Double-tap an empty spot to add a block there (a gap of up to about an hour is filled whole; in a bigger gap you get an hour from where you tapped), or rest a finger for a moment (it buzzes) and then drag down the day to select some time; then pick what it was (an activity with sub-activities asks which one, or "Just" the activity); you can also type a name, which suggests names you've used before and the likely activity. Taps on blocks only count when they're quick and the page isn't still gliding from a scroll, and a sheet ignores clicks for a moment after it opens so the tap that opened it can't pick something in it. Blocks have to be selected before they can be changed: tap one, or rest a finger on it, and it gets handles; then drag it to move it or pull a handle to resize, both in 15-minute steps that stop at the next block. Tap a selected block again, or tap anywhere off it, to let it go; scrolling keeps it selected. Each activity has a **look** (Solid, Soft, Bold, Hatched, Line, Arrow or Glow) that the day, week, dial and Home ribbon follow: Drift starts as a thin line and Transport as a grey highlighter arrow down the middle that reaches the next block. Filled blocks that touch join with square corners. Blocks with a sub-activity read "Uni · Lecture" unless you named them. Planned blocks still ahead show dashed; hold one and it fills with water, then becomes a logged block. The Plan button in the bottom corner opens "Show full plan" (including skipped blocks) and "Edit plan", with **templates** ("Uni day") that repeat on the weekdays you pick. A + sits in any unlogged gap you can tap to fill. The + only appears in waking hours, never in the night's sleep. Wake-up and bedtime are tags in the hour column you drag up or down. Bedtime can go as late as 6 am, and a logged block can run past midnight too (in the block editor an end time before the start means the next day): the day then runs past midnight, and the next day opens with that bedtime and the night's sleep. Swipe the date sideways to change day, or tap it for the week. **Week**: a weekly spread of seven day columns with sleep shaded and dotted lines joining wake-up and bed times; paint straight onto it or tap a day to open it. **Stats**: week and month charts. **Journal**: the note you write at the bottom of each day, newest first in one scroll; days without a note are skipped, and tapping a date opens that day. Timers still work. Week and month summaries by activity, split by sub-activity (with "Other" for time logged without one), and a Drift total.
- **Money:** one weekly allowance (Monday–Sunday) with money left and a per-day pace. Every spend must be marked need or want; tags are optional. Week view shows need vs want, each day against the pace, and tag totals. Month view is the calendar month against 4 × the weekly allowance, split by week. Recurring bills count toward the week they're paid in. Spend names are kept in lower case. In the Android app, purchase notifications from the bank or wallet apps you tick become spends to review once a day, from a card on Home and Money; you can rename each one and add or remove its tags right there, and each shop remembers its name, need or want and tags. Notifications stay on the phone (only ones with a dollar amount, from ticked apps, for 30 days).
- **Quick add (+):** log spending (keypad, need/want, tags) or time from any screen.
- **More:** the Store, and Settings (Display, Time tracking, Spend tracking, App and data). In Time tracking, drag an activity's handle to reorder it (the picker follows), tap its swatch to pick a look, and tap "+ sub" to add sub-activities in the same colour; removing one keeps its time under the activity.
- **Shelved (switched off in `src/app/features.ts`):** pages, written like notes. Each line of a page is a **to-do** (tap ○ to tick; it stays greyed until you swipe it left to remove it), a **repeat** ("weekly", "every 3 days", "every Sunday", "monthly on the 1st"), a **days-since** count (with an optional aim; it turns amber past it), a **heading** (tap › to fold what's under it) or a plain **note**. Hold ↻ or a count to mark it done: the line fills while you hold, the arrow spins, and Undo shows on the line. Tap ↻ or a count for the last 30 days and the longest gap. Tap the words to edit them, swipe a line right for its options (turn into another kind, aim, repeat style, due date, pin to Home, delete), and hold the words to drag the line somewhere else. Type on the empty last line ("every …", "since …", "## ", "- " set the kind) or paste several lines at once. With it on, what's due shows on Home and More, and a Tasks screen lists every to-do (lists, #tags, priority, due dates). Its data is still kept and migrated while it's off.



## Run it

```bash
npm install
npm run dev        # http://localhost:5173 in a browser, rebuilds on save (Android-only features are hidden)
npm run build      # writes dist/ (the app's files for Android) and preview/ (single-file preview)
npm test           # logic tests
npm run typecheck
```

## Android app

The app is built by GitHub Actions (`.github/workflows/android.yml`) on every push. The newest install file is always `matcha-planner.apk` on the **android-latest** release: https://github.com/hyuum/mink/releases/tag/android-latest

- **Install:** open that link on your phone, download `matcha-planner.apk`, open it and allow your browser to install apps. Later versions install over it as updates.
- **Back up:** More › App and data › Back up my data; restore from the same place.
- **Phone tracking:** More › Phone tracking › turn on "Suggest blocks from phone use", then allow **Usage access** for Matcha Planner. Stretches of phone use show up on the Day view as dotted blocks, snapped to the quarter hour like painted ones (slivers left between logged blocks are dropped). Hold one until it fills to approve it as it is, tap it to change its activity or name first, or use "Review" at the top for all of them. Settings: the shortest stretch that counts (15 minutes and up), how short a break gets joined over (10 minutes by default), what unlisted apps count as, and an activity (or "Don't count") for each app you used this week. It only reads which app was on screen and when, never what's inside it.
- **Code:** `android/` is the Capacitor project; `PhoneUsagePlugin.java` reads Android's usage stats, `src/lib/phone.ts` is the bridge, `phoneSuggestions` in `src/data/logic.ts` turns sessions into suggestions, and `src/features/time/phone.tsx` has the review sheet and settings.
- **Signing:** every build is signed with the same private key so updates install over each other. The key is committed only encrypted (`android/app/release.jks.enc`); the build unlocks it with the `ANDROID_KEY_PASSPHRASE` Actions secret, which is also the key's password. Keep that passphrase somewhere safe: without it, new builds can't update the installed app.

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

## Credits

Folder, list and tracker icons are from [Lucide](https://lucide.dev) (ISC licence).
