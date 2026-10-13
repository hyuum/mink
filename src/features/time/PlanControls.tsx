// Shown in the band while editing a day's plan: which template this weekday follows, the days a
// template repeats on, and saving the day back to its template or as a new one.
import { actions, useData } from '../../data/store';
import { planForDay, templateFor } from '../../data/logic';
import type { Day } from '../../data/types';
import { weekdayLong } from '../../lib/dates';
import { showToast } from '../../app/ui-state';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function PlanControls({ day }: { day: Day }) {
  const data = useData();
  const t = templateFor(data.templates, day);
  const plural = `${weekdayLong(day)}s`;
  const shape = (b: { label: string; categoryId: string; startMin: number; endMin: number }[]) =>
    JSON.stringify([...b].sort((x, y) => x.startMin - y.startMin).map((x) => [x.categoryId, x.label, x.startMin, x.endMin]));
  const differs = Boolean(t && data.planDays.includes(day) && shape(planForDay(data, day)) !== shape(t.blocks));

  const follow = (id: string | null) => {
    if ((t?.id ?? null) === id) return;
    const before = actions.setDayTemplate(day, id);
    const name = data.templates.find((x) => x.id === id)?.name;
    showToast(name ? `${plural} follow ${name}` : `${plural} have no template`, before);
  };
  const makeNew = () => {
    const name = `My day ${data.templates.length + 1}`;
    actions.addTemplateFromDay(day, name);
    showToast(`Made "${name}". Rename it and pick its days.`);
  };

  return (
    <div className="plan-controls">
      <div className="pc-row" role="radiogroup" aria-label={`Template ${plural} follow`}>
        <span className="pc-label">{plural} follow</span>
        {data.templates.map((x) => (
          <button key={x.id} type="button" role="radio" aria-checked={t?.id === x.id} onClick={() => follow(x.id)}>{x.name}</button>
        ))}
        <button type="button" role="radio" aria-checked={!t} onClick={() => follow(null)}>No template</button>
      </div>
      {t && (
        <>
          <div className="pc-row">
            <label className="pc-label" htmlFor="tpl-name">Template name</label>
            <input id="tpl-name" key={t.id} className="pc-name" defaultValue={t.name}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.name) actions.renameTemplate(t.id, v); }} />
          </div>
          <div className="pc-row" role="group" aria-label={`Days ${t.name} repeats on`}>
            <span className="pc-label">Repeats on</span>
            {WEEKDAYS.map((w, i) => (
              <button key={w} type="button" className="wk" aria-pressed={t.weekdays.includes(i)} aria-label={w} onClick={() => actions.toggleTemplateWeekday(t.id, i)}>{w[0]}</button>
            ))}
          </div>
        </>
      )}
      <div className="pc-row">
        {t && differs && <button type="button" className="dash" onClick={() => { actions.saveDayToTemplate(day); showToast(`Saved to ${t.name}`); }}>Save this day to {t.name}</button>}
        <button type="button" className="dash" onClick={makeNew}>+ New template from this day</button>
        {t && <button type="button" className="dash" onClick={() => { const before = actions.deleteTemplate(t.id); showToast(`Deleted ${t.name}`, before); }}>Delete {t.name}</button>}
      </div>
    </div>
  );
}
