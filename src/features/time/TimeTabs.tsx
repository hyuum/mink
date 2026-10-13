import { go, type Route } from '../../app/ui-state';

/** Day · Week · Stats switch in the Time band. */
export function TimeTabs({ current }: { current: 'time' | 'week' | 'stats' }) {
  const tabs: { route: Route; label: string }[] = [{ route: 'time', label: 'Day' }, { route: 'week', label: 'Week' }, { route: 'stats', label: 'Stats' }];
  return (
    <div className="seg" role="tablist" aria-label="View">
      {tabs.map((t) => (
        <button key={t.route} role="tab" aria-selected={current === t.route} onClick={() => current !== t.route && go(t.route)}>{t.label}</button>
      ))}
    </div>
  );
}
