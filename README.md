# Matcha Planner

A cosy, local-first personal planner for your phone: a painted day timesheet, a weekly spending allowance and tasks.
Everything is stored on your device (IndexedDB). There is no account and no server.

## What works in this build

- **Home:** today's time, spending and tasks at a glance, a live timer, this week's stickers, and quick task entry.
- **Time:** three tabs. **Day**: paint the day, Jibun Techo style, from a palette docked above the nav (tap the list button to show names; it remembers). **Week**: a weekly spread of seven day columns with sleep shaded and dotted lines joining wake-up and bed times; paint straight onto it or tap a day to open it. **Stats**: week and month charts. Milestones (Wake up, Leave home, Arrive, Lunch, Home, Bed, or your own) come from the flag button and sit on top of painted time; a bedtime after midnight belongs to the evening before. A 24-hour dial of the day is tucked behind "Dial" on the Day screen. Pick an activity (Uni, Work, Friends, Transport, Meals, Exercise, Chores, Rest, Me time, Drift for doomscrolling) and drag down the timeline in 15-minute steps. Painting over a block trims or splits it, neighbouring blocks of the same activity merge, and the Eraser clears time. Blank time is counted as unlogged. Tap a block to add a note or exact times. Timers and planned (dashed) blocks still work. Week and month summaries by activity, with a Drift total.
- **Money:** one weekly allowance (Monday–Sunday) with money left and a per-day pace. Every spend must be marked need or want; tags are optional. Week view shows need vs want, each day against the pace, and tag totals. Month view is the calendar month against 4 × the weekly allowance, split by week. Recurring bills count toward the week they're paid in.
- **Tasks:** separate lists, #tags, priority (`!` or `!!`), due dates, and groups for Overdue, Today, Next 7 days, Later, No date and Done.
- **Quick add (+):** log spending (keypad, need/want, tags), time or a task from any screen.
- **More:** theme, timeline hours, daily goal, stickers, categories, backup and restore, and the example week.

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

## How the code is laid out

```
src/
  data/       types.ts (the data model), store.ts (state + actions + saving),
              persist.ts (IndexedDB with fallbacks), logic.ts (pure summaries, bills, tasks), seed.ts
  lib/        dates.ts, money.ts (cents, keypad rules), id.ts
  features/   home/, time/, money/, tasks/, add/ (quick add), more/
  ui/         kit.tsx (cards, sheet, chips, checkbox, nav, toasts), icons.tsx
  app/        App.tsx (screens), ui-state.ts (route, quick add, toasts, clock)
  styles/     app.css (theme tokens for light and dark, then components)
tests/        logic.test.ts (node:test), smoke.py (Playwright walk-through at phone size)
```

- **Adding a module** (e.g. Trackers): add its types to `AppData`, defaults in `seed.ts`, a `migrate` default in `store.ts`, actions in `store.ts`, pure helpers in `logic.ts`, and a screen under `features/`. Register the screen in `App.tsx` and `ui-state.ts`.
- **Theme:** every colour is a CSS variable at the top of `app.css`. Swapping the palette is one block.
- **Time entries** carry a `source` (`paint`, `timer`, `manual`, and `device` reserved for syncing phone activity later).
- **Money** is stored in integer cents. **Days** are local `YYYY-MM-DD` strings and **instants** are epoch milliseconds.
- **Backups:** More › Back up my data gives you a JSON copy. Restore accepts the same JSON.
