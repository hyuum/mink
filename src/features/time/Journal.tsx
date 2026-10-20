// Journal: the notes written at the end of each day, newest first, in one scroll. Days without a note are
// skipped, so there are no empty days; a month heading marks where each month starts.
import { useEffect, useRef, useState } from 'react';
import { actions, useData } from '../../data/store';
import { dayTotals } from '../../data/logic';
import { dayNum, monthName, monthOf, todayISO, weekdayLong } from '../../lib/dates';
import { go, timeDay, useNow } from '../../app/ui-state';
import { Band, Bar } from '../../ui/kit';
import { TimeTabs } from './TimeTabs';

export function Journal() {
  const data = useData();
  const now = useNow(60_000);
  const today = todayISO(now);
  const notes = [...data.notes].sort((a, b) => b.day.localeCompare(a.day));
  const cat = (id: string) => data.timeCategories.find((c) => c.id === id);
  const open = (day: string) => { timeDay.set(day === today ? null : day); go('time'); };

  return (
    <>
      <Band>
        <div className="band-row"><TimeTabs current="journal" /></div>
        <div className="band-row">
          <div>
            <h1>Journal</h1>
            <p className="band-sub">{notes.length ? `${notes.length} ${notes.length === 1 ? 'day' : 'days'} written` : 'Notes from the end of each day'}</p>
          </div>
        </div>
      </Band>
      <div className="content journal">
        {notes.length === 0 && (
          <div className="card">
            <p style={{ fontSize: 14 }}>Nothing written yet. At the bottom of each day there's a note: write a line or two about how it went, and it shows up here.</p>
            <button type="button" className="btn" style={{ marginTop: 10 }} onClick={() => open(today)}>Write today's note</button>
          </div>
        )}
        {notes.map((n, i) => {
          const month = monthOf(n.day);
          const newMonth = i === 0 || monthOf(notes[i - 1].day) !== month;
          const totals = dayTotals(data.entries, n.day, now);
          const cats = Object.keys(totals.byCat).sort((a, b) => totals.byCat[b] - totals.byCat[a]);
          return (
            <div key={n.day} className="stack" style={{ gap: 8 }}>
              {newMonth && <p className="section-label">{monthName(month)}{month.slice(0, 4) !== today.slice(0, 4) ? ` ${month.slice(0, 4)}` : ''}</p>}
              <article className="card jentry">
                <button type="button" className="jdate" onClick={() => open(n.day)} aria-label={`Open ${weekdayLong(n.day)} ${dayNum(n.day)}`}>
                  <span className="jnum">{dayNum(n.day)}</span>
                  <span className="jday">{n.day === today ? 'Today' : weekdayLong(n.day)}</span>
                </button>
                {totals.total > 0 && <Bar height={4} segments={cats.map((c) => ({ value: totals.byCat[c], color: cat(c)?.color ?? '#ccc' }))} max={totals.total} />}
                <NoteText day={n.day} text={n.text} />
              </article>
            </div>
          );
        })}
      </div>
    </>
  );
}

/** The note itself; tap to edit it in place. */
function NoteText({ day, text }: { day: string; text: string }) {
  const [editing, setEditing] = useState(false);
  if (!editing) return <p className="jtext" onClick={() => setEditing(true)}>{text}</p>;
  return <NoteBox day={day} initial={text} autoFocus onDone={() => setEditing(false)} />;
}

/**
 * A note box that grows with its text and saves as you type (and when you leave it).
 * Clearing it removes the note.
 */
export function NoteBox({ day, initial, autoFocus, onDone }: { day: string; initial: string; autoFocus?: boolean; onDone?: () => void }) {
  const [text, setText] = useState(initial);
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const saved = useRef(initial);
  const save = (v: string) => { if (v !== saved.current) { saved.current = v; actions.setNote(day, v); } };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [text]);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <textarea
      ref={ref} className="note-box" rows={2} autoFocus={autoFocus} aria-label="Note for this day" placeholder="How did the day go?"
      value={text}
      onChange={(e) => { const v = e.target.value; setText(v); clearTimeout(timer.current); timer.current = setTimeout(() => save(v), 600); }}
      onBlur={() => { clearTimeout(timer.current); save(text); onDone?.(); }}
    />
  );
}
