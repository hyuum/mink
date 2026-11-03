import { useEffect } from 'react';
import { useData, useReady } from '../data/store';
import { brush, tryOn, useRoute } from './ui-state';
import { isSkin } from '../data/logic';
import { loadSkinFont } from '../lib/fonts';
import { PAGES } from './features';
import { BottomNav, ToastHost } from '../ui/kit';
import { Home } from '../features/home/Home';
import { TimeDay } from '../features/time/TimeDay';
import { TimeSummary } from '../features/time/TimeSummary';
import { Journal } from '../features/time/Journal';
import { TimeWeek } from '../features/time/TimeWeek';
import { Money } from '../features/money/Money';
import { Tasks } from '../features/tasks/Tasks';
import { More } from '../features/more/Hub';
import { QuickAdd } from '../features/add/QuickAdd';
import { CelebrationHost, useDailyRewards } from '../features/dailies/Dailies';

const SCREENS = { home: Home, time: TimeDay, week: TimeWeek, stats: TimeSummary, journal: Journal, money: Money, tasks: Tasks, more: More };
const TITLES = { home: 'Home', time: 'Time', week: 'Week', stats: 'Time stats', journal: 'Journal', money: 'Money', tasks: 'Tasks', more: 'More' };

/** Applies an explicit light/dark choice; "Match device" leaves the page alone. */
function useTheme(theme: 'system' | 'light' | 'dark') {
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      if (root.dataset.appTheme) { delete root.dataset.appTheme; delete root.dataset.theme; }
    } else {
      root.dataset.appTheme = '1';
      root.dataset.theme = theme;
    }
  }, [theme]);
}

/** The colour theme or skin bought in the Store (or being tried on there); Matcha needs nothing set. */
function usePalette(palette: string) {
  useEffect(() => {
    const root = document.documentElement;
    if (palette && palette !== 'matcha') root.dataset.palette = palette;
    else delete root.dataset.palette;
    if (isSkin(palette)) { root.dataset.skin = palette; loadSkinFont(); } else delete root.dataset.skin;
  }, [palette]);
}

export function App() {
  const ready = useReady();
  const data = useData();
  const route = useRoute();
  const look = tryOn.use() ?? data.settings.palette;
  // A skin brings its own colours, so it overrides the light/dark setting.
  useTheme(isSkin(look) ? 'light' : data.settings.theme);
  usePalette(look);
  useDailyRewards();
  useEffect(() => { document.title = `${TITLES[route]} · Matcha Planner`; }, [route]);
  // Leaving the painting screens puts the brush down.
  useEffect(() => { if (route !== 'time' && route !== 'week') brush.set(null); }, [route]);

  if (!ready) return <div className="loading">Opening your planner…</div>;
  // With pages switched off, the Tasks screen isn't reachable; an old link to it opens Home.
  const Screen = SCREENS[!PAGES && route === 'tasks' ? 'home' : route];
  return (
    <>
      <main className="app" key={route}>
        <Screen />
      </main>
      <BottomNav />
      <QuickAdd />
      <ToastHost />
      <CelebrationHost />
    </>
  );
}
