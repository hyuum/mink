import { useEffect } from 'react';
import { useData, useReady } from '../data/store';
import { brush, updateReady, useRoute } from './ui-state';
import { BottomNav, ToastHost } from '../ui/kit';
import { Home } from '../features/home/Home';
import { TimeDay } from '../features/time/TimeDay';
import { TimeSummary } from '../features/time/TimeSummary';
import { TimeWeek } from '../features/time/TimeWeek';
import { Money } from '../features/money/Money';
import { Tasks } from '../features/tasks/Tasks';
import { More } from '../features/more/More';
import { QuickAdd } from '../features/add/QuickAdd';

const SCREENS = { home: Home, time: TimeDay, week: TimeWeek, stats: TimeSummary, money: Money, tasks: Tasks, more: More };
const TITLES = { home: 'Home', time: 'Time', week: 'Week', stats: 'Time stats', money: 'Money', tasks: 'Tasks', more: 'More' };

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

export function App() {
  const ready = useReady();
  const data = useData();
  const route = useRoute();
  const update = updateReady.use();
  useTheme(data.settings.theme);
  useEffect(() => { document.title = `${TITLES[route]} · Matcha Planner`; }, [route]);
  // Leaving the painting screens puts the brush down.
  useEffect(() => { if (route !== 'time' && route !== 'week') brush.set(null); }, [route]);

  if (!ready) return <div className="loading">Opening your planner…</div>;
  const Screen = SCREENS[route];
  return (
    <>
      <main className="app" key={route}>
        <Screen />
      </main>
      <BottomNav />
      <QuickAdd />
      <ToastHost />
      {update && (
        <div className="update-bar" role="status">
          <span>A new version is ready</span>
          <button type="button" onClick={() => location.reload()}>Refresh</button>
          <button type="button" className="later" aria-label="Later" onClick={() => updateReady.set(false)}>Later</button>
        </div>
      )}
    </>
  );
}
