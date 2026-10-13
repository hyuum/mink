// A 24-hour ring for one day: midnight at the top, sleep hatched, milestones around the edge.
// An extra way to look at the day; tucked behind a small toggle on the Day screen.
import type { Milestone, TimeCategory, TimeEntry } from '../../data/types';
import { entryEnd } from '../../data/logic';
import { DRIFT_ID } from '../../data/seed';
import { dayStartMs, fmtDuration } from '../../lib/dates';
import { MilestoneIcon } from './Milestones';

const C = 150, RO = 128, RI = 90;
const pol = (min: number, r: number) => {
  const a = (min / 1440) * 2 * Math.PI - Math.PI / 2;
  return [C + r * Math.cos(a), C + r * Math.sin(a)] as const;
};
function sector(a: number, b: number, ro = RO, ri = RI) {
  const large = b - a > 720 ? 1 : 0;
  const [x1, y1] = pol(a, ro), [x2, y2] = pol(b, ro), [x3, y3] = pol(b, ri), [x4, y4] = pol(a, ri);
  return `M${x1} ${y1}A${ro} ${ro} 0 ${large} 1 ${x2} ${y2}L${x3} ${y3}A${ri} ${ri} 0 ${large} 0 ${x4} ${y4}Z`;
}

export function Dial({ day, entries, cats, milestones, now, total, isToday }: {
  day: string; entries: TimeEntry[]; cats: TimeCategory[]; milestones: Milestone[]; now: number; total: number; isToday: boolean;
}) {
  const start = dayStartMs(day);
  const toMin = (ms: number) => Math.max(0, Math.min(1440, (ms - start) / 60_000));
  const wake = milestones.find((m) => m.kind === 'wake');
  const bed = milestones.find((m) => m.kind === 'bed');
  const nowMin = isToday ? toMin(now) : null;
  return (
    <svg viewBox="0 0 300 300" width="100%" style={{ maxWidth: 320, display: 'block', margin: '0 auto' }} role="img" aria-label={`The day as a 24-hour ring, ${fmtDuration(total)} logged`}>
      <defs>
        <pattern id="dial-sleep" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="var(--track)" /><rect width="3" height="6" fill="var(--sleep)" /></pattern>
        <pattern id="dial-drift" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#B8B2C2" /><rect width="2.5" height="6" fill="#D6D2DD" /></pattern>
      </defs>
      <circle cx={C} cy={C} r={(RO + RI) / 2} fill="none" stroke="var(--track)" strokeWidth={RO - RI} />
      {wake && wake.min > 0 && <path d={sector(0, Math.min(wake.min, 1439))} fill="url(#dial-sleep)" />}
      {bed && bed.min < 1440 && <path d={sector(bed.min, 1440)} fill="url(#dial-sleep)" />}
      {entries.map((e) => {
        const a = toMin(e.start), b = toMin(entryEnd(e, now));
        if (b - a < 2) return null;
        const c = cats.find((x) => x.id === e.categoryId);
        return <path key={e.id} d={sector(a + 0.6, b - 0.6)} fill={e.categoryId === DRIFT_ID ? 'url(#dial-drift)' : c?.color ?? '#ccc'} />;
      })}
      {Array.from({ length: 24 }, (_, h) => {
        const [x1, y1] = pol(h * 60, RI - 4), [x2, y2] = pol(h * 60, RI - (h % 6 === 0 ? 10 : 6));
        return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeOpacity={0.5} strokeWidth={h % 6 === 0 ? 1.5 : 1} />;
      })}
      {[[0, '12a'], [6, '6a'], [12, '12p'], [18, '6p']].map(([h, l]) => {
        const [x, y] = pol((h as number) * 60, RI - 22);
        return <text key={l} x={x} y={y + 4} textAnchor="middle" fontSize="11" fill="var(--muted)">{l}</text>;
      })}
      {nowMin !== null && (() => { const [x1, y1] = pol(nowMin, RI - 2), [x2, y2] = pol(nowMin, RO + 5); return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--accent)" strokeWidth={2.5} strokeLinecap="round" />; })()}
      {milestones.map((m) => {
        const [x, y] = pol(Math.min(m.min, 1439), RO + 13);
        return (
          <g key={m.id} transform={`translate(${x - 9} ${y - 9})`} style={{ color: 'var(--pink-ink)' }}>
            <circle cx="9" cy="9" r="9.5" fill="var(--card)" stroke="var(--pink-soft)" />
            <g transform="translate(2.5 2.5)"><MilestoneIcon kind={m.kind} size={13} /></g>
          </g>
        );
      })}
      <text x={C} y={C - 4} textAnchor="middle" fontSize="28" fill="var(--ink)" style={{ fontFamily: 'var(--font-display)' }}>{fmtDuration(total)}</text>
      <text x={C} y={C + 16} textAnchor="middle" fontSize="12" fill="var(--muted)">logged</text>
    </svg>
  );
}
