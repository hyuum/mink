// More: a notes-style list of folders (task lists, trackers, checklists, collections, wishlists),
// what's due today across them, and the way into Settings.
import { useEffect, useState, type FormEvent } from 'react';
import { actions, useData } from '../../data/store';
import { dueTrackers, trackerStatus } from '../../data/logic';
import { LIST_EMOJI } from '../../data/seed';
import type { Folder, FolderType, ID, ListItem, RepeatUnit, TrackerItem } from '../../data/types';
import { addDays, todayISO } from '../../lib/dates';
import { fmtMoney, parseAmount } from '../../lib/money';
import { go, moreView, showToast, taskListFilter, useNow } from '../../app/ui-state';
import { Band, Sheet } from '../../ui/kit';
import { Settings } from './More';

const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;
const everyText = (t: TrackerItem) => {
  const e = t.every ?? { n: 1, unit: 'week' };
  if (e.unit === 'month' && t.onDay) return `${e.n === 1 ? 'monthly' : `every ${e.n} months`} on the ${ordinal(t.onDay)}`;
  return e.n === 1 ? `every ${e.unit}` : `every ${e.n} ${e.unit}s`;
};
const ordinal = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
export const listEmoji = (l: { id: string; emoji?: string }) => l.emoji ?? LIST_EMOJI[l.id] ?? '☑️';

/** "Due today", "Due in 3 days", "2 days overdue"… */
function dueText(t: TrackerItem, today: string): { text: string; tone: '' | 'today' | 'late' } {
  const s = trackerStatus(t, today);
  if (s.kind !== 'every') return { text: '', tone: '' };
  if (s.doneToday) return { text: 'Done today', tone: '' };
  if (s.daysLeft > 1) return { text: `Due in ${s.daysLeft} days · ${everyText(t)}`, tone: '' };
  if (s.daysLeft === 1) return { text: `Due tomorrow · ${everyText(t)}`, tone: '' };
  if (s.daysLeft === 0) return { text: 'Due today', tone: 'today' };
  return { text: `${plural(-s.daysLeft, 'day')} overdue`, tone: 'late' };
}

export function More() {
  const view = moreView.use();
  useEffect(() => {
    if (view.kind === 'settings' && view.section) document.getElementById(view.section)?.scrollIntoView({ block: 'start' });
    else window.scrollTo({ top: 0 });
  }, [view]);
  if (view.kind === 'settings') return <Settings />;
  if (view.kind === 'folder') return <FolderView id={view.id} />;
  return <Hub />;
}

/* ---------- Hub ---------- */

function Hub() {
  const data = useData();
  const now = useNow(60_000);
  const today = todayISO(now);
  const [making, setMaking] = useState(false);
  const due = dueTrackers(data.trackers, today);
  const open = (id: string) => moreView.set({ kind: 'folder', id });

  const preview = (f: Folder): string => {
    if (f.type === 'tracker') {
      const items = data.trackers.filter((t) => t.folderId === f.id);
      const d = dueTrackers(items, today);
      if (d.length) return `${d.map((x) => x.item.name).slice(0, 2).join(', ')} due`;
      const since = items.find((t) => t.kind === 'since');
      if (since) { const s = trackerStatus(since, today); return s.kind === 'since' ? `${plural(s.days, 'day')} since ${since.name.toLowerCase()}` : ''; }
      const next = items.map((t) => ({ t, s: trackerStatus(t, today) })).sort((a, b) => (a.s.kind === 'every' && b.s.kind === 'every' ? a.s.daysLeft - b.s.daysLeft : 0))[0];
      return next ? `${next.t.name}: ${dueText(next.t, today).text.split(' · ')[0].toLowerCase()}` : 'Empty';
    }
    const items = data.listItems.filter((i) => i.folderId === f.id);
    if (!items.length) return 'Empty';
    if (f.type === 'check') { const left = items.filter((i) => !i.done); return left.length ? `${left.length} to get: ${left.map((i) => i.text).slice(0, 3).join(', ')}` : 'All ticked'; }
    if (f.type === 'collect') { const now_ = items.filter((i) => i.status === 'doing'); return now_.length ? `Now: ${now_.map((i) => i.text).join(', ')}` : items.map((i) => i.text).slice(0, 2).join(', '); }
    return `${fmtMoney(items.reduce((t, i) => t + (i.price ?? 0), 0))} · ${items.map((i) => i.text).slice(0, 2).join(', ')}`;
  };
  const count = (f: Folder) => (f.type === 'tracker' ? data.trackers : data.listItems).filter((x) => x.folderId === f.id).length;

  return (
    <>
      <Band>
        <div className="band-row">
          <h1>More</h1>
          <button type="button" className="round-btn" aria-label="New folder" onClick={() => setMaking(true)}>+</button>
        </div>
      </Band>
      <div className="content">
        {due.length > 0 && (
          <>
            <p className="section-label">Due today</p>
            <div className="card rows">{due.map(({ item }) => <TrackerRow key={item.id} t={item} today={today} />)}</div>
          </>
        )}
        <p className="section-label">Folders</p>
        <div className="card rows">
          {data.lists.map((l) => {
            const openTasks = data.tasks.filter((t) => t.listId === l.id && !t.done);
            return (
              <button key={l.id} type="button" className="rowbtn" onClick={() => { taskListFilter.set(l.id); go('tasks'); }}>
                <span className="ico">{listEmoji(l)}</span>
                <span className="grow"><b>{l.name}</b><small>{openTasks.length ? openTasks.slice(0, 2).map((t) => t.title).join(', ') : 'No open tasks'}</small></span>
                <span className="count">{openTasks.length}</span><span className="chev" aria-hidden="true">›</span>
              </button>
            );
          })}
          {data.folders.map((f) => (
            <button key={f.id} type="button" className="rowbtn" onClick={() => open(f.id)}>
              <span className="ico">{f.emoji}</span>
              <span className="grow"><b>{f.name}</b><small>{preview(f)}</small></span>
              <span className="count">{count(f)}</span><span className="chev" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
        <p className="section-label">Settings</p>
        <div className="card rows">
          {[['Activities', 'set-activities'], ['Phone tracking', 'set-phone'], ['Theme and day timeline', 'set-display'], ['Your data', 'set-data']].map(([name, section]) => (
            <button key={section} type="button" className="rowbtn short" onClick={() => moreView.set({ kind: 'settings', section })}>
              <span className="grow">{name}</span><span className="chev" aria-hidden="true">›</span>
            </button>
          ))}
        </div>
      </div>
      <NewFolderSheet open={making} onClose={() => setMaking(false)} />
    </>
  );
}

/* ---------- Trackers ---------- */

function TrackerRow({ t, today }: { t: TrackerItem; today: string }) {
  const [open, setOpen] = useState(false);
  const s = trackerStatus(t, today);
  const hit = () => {
    const before = actions.hitTracker(t.id, today);
    if (s.kind === 'since') showToast(`Reset after ${plural(s.days, 'day')}`, before);
    else {
      const next = trackerStatus({ ...t, hits: [...t.hits, today].sort() }, today);
      showToast(`${t.name} done${next.kind === 'every' ? ` · next ${next.daysLeft === 1 ? 'tomorrow' : `in ${plural(next.daysLeft, 'day')}`}` : ''}`, before);
    }
  };
  const due = dueText(t, today);
  const days = Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
  return (
    <div className="tgroup">
      <div className="trow">
        <span className="emoji" aria-hidden="true">{t.emoji}</span>
        <button type="button" className="main" aria-expanded={open} onClick={() => setOpen(!open)}>
          <b>{t.name}</b>
          {s.kind === 'since'
            ? <small>Best run {plural(s.best, 'day')}</small>
            : <small className={due.tone}>{due.text}</small>}
        </button>
        {s.kind === 'since' ? (
          <>
            <span className="big">{s.days}<small>days</small></span>
            <button type="button" className="act" onClick={hit} disabled={t.hits.includes(today)}>It happened</button>
          </>
        ) : s.doneToday
          ? <button type="button" className="act" disabled>Done ✓</button>
          : <button type="button" className="act do" onClick={hit}>Done</button>}
      </div>
      {open && (
        <div className="detail">
          <div className="dots" aria-label="Last 30 days">
            {days.map((d) => <span key={d} className={t.hits.includes(d) ? `hit ${t.kind === 'since' ? 'since' : ''}` : ''} title={d} />)}
          </div>
          <p className="small muted">Last 30 days · {s.kind === 'every' ? `streak ${s.streak} · ${everyText(t)}` : `${plural(t.hits.length, 'time')} in all`}</p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button type="button" className="act" onClick={() => actions.updateTracker(t.id, { pinned: !t.pinned })}>{t.pinned ? '★ Unpin from Home' : '☆ Pin to Home'}</button>
            <button type="button" className="act" onClick={() => { const before = actions.deleteTracker(t.id); showToast(`Deleted ${t.name}`, before); }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

const TRACKER_EMOJI = ['✨', '👕', '🪴', '🧹', '🛏️', '💸', '💊', '🏃', '📱', '🧋', '📞', '🦷'];

function AddTrackerSheet({ folderId, open, onClose }: { folderId: ID; open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState<'every' | 'since'>('every');
  const [n, setN] = useState(1);
  const [unit, setUnit] = useState<RepeatUnit>('week');
  const [onDay, setOnDay] = useState(0);
  const [emoji, setEmoji] = useState(TRACKER_EMOJI[0]);
  const today = todayISO();
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    actions.addTracker({ folderId, name: name.trim(), emoji, kind, hits: [], since: today, ...(kind === 'every' ? { every: { n, unit }, ...(unit === 'month' && onDay ? { onDay } : {}) } : {}) });
    showToast(`Added ${name.trim()}`);
    setName(''); onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} label="Add to tracker">
      <form className="stack" style={{ gap: 12 }} onSubmit={save}>
        <h2>Add</h2>
        <input className="field-input" aria-label="Name" placeholder="e.g. Vacuum, Pay rent, Skip breakfast" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="types">
          <button type="button" className="type" aria-pressed={kind === 'every'} onClick={() => setKind('every')}><b>Repeats</b><small>Shows when it's due. Chores, habits to keep up</small></button>
          <button type="button" className="type" aria-pressed={kind === 'since'} onClick={() => setKind('since')}><b>Days since</b><small>Counts up. Habits to avoid</small></button>
        </div>
        {kind === 'every' && (
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <span className="small">Every</span>
            <select className="field-input auto" aria-label="How many" value={n} onChange={(e) => setN(Number(e.target.value))}>{[1, 2, 3, 4, 5, 6].map((x) => <option key={x} value={x}>{x}</option>)}</select>
            <select className="field-input auto" aria-label="Unit" value={unit} onChange={(e) => setUnit(e.target.value as RepeatUnit)}>
              <option value="day">{n === 1 ? 'day' : 'days'}</option><option value="week">{n === 1 ? 'week' : 'weeks'}</option><option value="month">{n === 1 ? 'month' : 'months'}</option>
            </select>
            {unit === 'month' && (
              <select className="field-input auto" aria-label="Which day" value={onDay} onChange={(e) => setOnDay(Number(e.target.value))}>
                <option value={0}>after last time</option>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>on the {ordinal(d)}</option>)}
              </select>
            )}
          </div>
        )}
        <div className="emojis">{TRACKER_EMOJI.map((e) => <button key={e} type="button" aria-pressed={emoji === e} onClick={() => setEmoji(e)}>{e}</button>)}</div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn green grow">Add</button>
        </div>
      </form>
    </Sheet>
  );
}

/* ---------- Folder screens ---------- */

function FolderView({ id }: { id: ID }) {
  const data = useData();
  const today = todayISO(useNow(60_000));
  const folder = data.folders.find((f) => f.id === id);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  if (!folder) return <Hub />;
  const items = data.listItems.filter((i) => i.folderId === id);
  const trackers = data.trackers.filter((t) => t.folderId === id);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    if (folder.type === 'wish') {
      const m = /^(.*?)\s*\$?(\d+(?:\.\d{1,2})?)$/.exec(v);
      actions.addListItem({ folderId: id, text: m && m[1] ? m[1] : v, price: m && m[1] ? parseAmount(m[2]) ?? 0 : 0 });
    } else actions.addListItem({ folderId: id, text: v, ...(folder.type === 'collect' ? { status: 'want' as const } : {}) });
    setText('');
  };
  const sorted = [...trackers].sort((a, b) => {
    const sa = trackerStatus(a, today), sb = trackerStatus(b, today);
    if (sa.kind !== sb.kind) return sa.kind === 'every' ? -1 : 1;
    return sa.kind === 'every' && sb.kind === 'every' ? sa.daysLeft - sb.daysLeft : 0;
  });
  const total = items.reduce((t, i) => t + (i.price ?? 0), 0);

  return (
    <>
      <Band>
        <button type="button" className="backlink" onClick={() => moreView.set({ kind: 'hub' })}>‹ More</button>
        <div className="band-row">
          <h1>{folder.emoji} {folder.name}</h1>
          <div className="row" style={{ gap: 8 }}>
            {folder.type === 'check' && items.some((i) => i.done) && (
              <button type="button" className="act" onClick={() => { const before = actions.clearTicked(id); showToast('Cleared ticked items', before); }}>Clear ticked</button>
            )}
            <button type="button" className="round-btn" aria-label="Folder options" onClick={() => setEditing(true)}>⋯</button>
          </div>
        </div>
        <p className="band-sub">{folder.type === 'tracker' ? plural(trackers.length, 'item') : folder.type === 'wish' ? `${fmtMoney(total)} in all` : plural(items.length, 'item')}</p>
      </Band>
      <div className="content">
        <div className="card rows">
          {folder.type === 'tracker' && (
            <>
              {sorted.map((t) => <TrackerRow key={t.id} t={t} today={today} />)}
              {!sorted.length && <p className="small muted" style={{ padding: 16 }}>Nothing here yet.</p>}
              <div className="add-row"><button type="button" className="btn green block" onClick={() => setAdding(true)}>+ Add</button></div>
            </>
          )}
          {folder.type !== 'tracker' && (
            <>
              {items.map((i) => <ListRow key={i.id} item={i} type={folder.type} today={today} />)}
              <form className="add-row" onSubmit={add}>
                <input className="field-input dashed grow" aria-label="New item" value={text} onChange={(e) => setText(e.target.value)}
                  placeholder={folder.type === 'wish' ? 'Add with a price, e.g. Tote bag 45' : 'Add…'} />
                <button type="submit" className="btn green">Add</button>
              </form>
            </>
          )}
        </div>
      </div>
      {folder.type === 'tracker' && <AddTrackerSheet folderId={id} open={adding} onClose={() => setAdding(false)} />}
      <FolderOptions folder={folder} open={editing} onClose={() => setEditing(false)} />
    </>
  );
}

function ListRow({ item, type, today }: { item: ListItem; type: FolderType; today: string }) {
  if (type === 'check') {
    return (
      <div className={`item ${item.done ? 'done' : ''}`}>
        <input type="checkbox" id={`li-${item.id}`} checked={Boolean(item.done)} onChange={(e) => actions.updateListItem(item.id, { done: e.target.checked })} />
        <label htmlFor={`li-${item.id}`} className="name">{item.text}</label>
        <button type="button" className="x" aria-label={`Delete ${item.text}`} onClick={() => { const before = actions.deleteListItem(item.id); showToast('Deleted', before); }}>×</button>
      </div>
    );
  }
  if (type === 'collect') {
    return (
      <div className="item">
        <span className="name">{item.text}
          {item.status === 'done' && (
            <span className="stars">{[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" className={s <= (item.stars ?? 0) ? 'on' : ''} aria-label={`${s} stars`} onClick={() => actions.updateListItem(item.id, { stars: s })}>★</button>
            ))}</span>
          )}
        </span>
        <span className="status" role="radiogroup" aria-label={`${item.text} status`}>
          {([['want', 'Want'], ['doing', 'Now'], ['done', 'Done']] as const).map(([k, n]) => (
            <button key={k} type="button" role="radio" aria-checked={item.status === k} onClick={() => actions.updateListItem(item.id, { status: k })}>{n}</button>
          ))}
        </span>
      </div>
    );
  }
  return (
    <div className="item">
      <span className="name">{item.text}</span>
      <span className="price">{fmtMoney(item.price ?? 0)}</span>
      <button type="button" className="act" onClick={() => { const before = actions.buyWish(item.id, today); showToast(`Logged ${fmtMoney(item.price ?? 0)} on Money · ${item.text}`, before); }}>Bought</button>
    </div>
  );
}

/* ---------- Making and editing folders ---------- */

const FOLDER_EMOJI = ['📁', '🌱', '🧺', '🛒', '📚', '🎁', '🍜', '🎬', '✈️', '💊', '🐾', '🎵', '🎓', '💼'];
const TYPES: { type: FolderType | 'tasks'; name: string; hint: string }[] = [
  { type: 'tasks', name: 'Tasks', hint: 'To-dos with due dates' },
  { type: 'tracker', name: 'Tracker', hint: 'Habits and chores: days since, or every week or month' },
  { type: 'check', name: 'Checklist', hint: 'Tick off, then clear' },
  { type: 'collect', name: 'Collection', hint: 'Want, now, done, with stars' },
  { type: 'wish', name: 'Wishlist', hint: 'With prices; logs to Money' },
];

function NewFolderSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [type, setType] = useState<FolderType | 'tasks'>('tracker');
  const [emoji, setEmoji] = useState(FOLDER_EMOJI[0]);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (type === 'tasks') { const id = actions.addList(name.trim(), emoji); taskListFilter.set(id); go('tasks'); }
    else { const id = actions.addFolder({ name: name.trim(), emoji, type }); moreView.set({ kind: 'folder', id }); }
    showToast(`Made ${name.trim()}`);
    setName(''); onClose();
  };
  return (
    <Sheet open={open} onClose={onClose} label="New folder">
      <form className="stack" style={{ gap: 12 }} onSubmit={save}>
        <h2>New folder</h2>
        <input className="field-input" aria-label="Folder name" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <div className="types">
          {TYPES.map((t) => (
            <button key={t.type} type="button" className="type" aria-pressed={type === t.type} onClick={() => setType(t.type)}><b>{t.name}</b><small>{t.hint}</small></button>
          ))}
        </div>
        <div className="emojis">{FOLDER_EMOJI.map((e) => <button key={e} type="button" aria-pressed={emoji === e} onClick={() => setEmoji(e)}>{e}</button>)}</div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn green grow">Make folder</button>
        </div>
      </form>
    </Sheet>
  );
}

function FolderOptions({ folder, open, onClose }: { folder: Folder; open: boolean; onClose: () => void }) {
  const [name, setName] = useState(folder.name);
  return (
    <Sheet open={open} onClose={onClose} label="Folder options">
      <div className="stack" style={{ gap: 12 }}>
        <h2>Folder</h2>
        <input className="field-input" aria-label="Folder name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && actions.updateFolder(folder.id, { name: name.trim() })} />
        <div className="emojis">{FOLDER_EMOJI.map((e) => <button key={e} type="button" aria-pressed={folder.emoji === e} onClick={() => actions.updateFolder(folder.id, { emoji: e })}>{e}</button>)}</div>
        <div className="row" style={{ gap: 8 }}>
          <button type="button" className="btn danger" onClick={() => { const before = actions.deleteFolder(folder.id); moreView.set({ kind: 'hub' }); onClose(); showToast(`Deleted ${folder.name}`, before); }}>Delete folder</button>
          <button type="button" className="btn green grow" onClick={() => { if (name.trim()) actions.updateFolder(folder.id, { name: name.trim() }); onClose(); }}>Done</button>
        </div>
      </div>
    </Sheet>
  );
}
