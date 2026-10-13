// The + button: log spending, time or a task from anywhere.
import { useState, type FormEvent } from 'react';
import { actions, useData } from '../../data/store';
import { moneyTags, parseTaskInput, recentActivities } from '../../data/logic';
import type { Priority, SpendKind } from '../../data/types';
import { addDays, fromTimeInput, minutesOfDay, msAt, toTimeInput, todayISO } from '../../lib/dates';
import { fmtMoney, parseAmount, pressKey } from '../../lib/money';
import { closeQuickAdd, quickAdd, showToast, type AddTab } from '../../app/ui-state';
import { ChipGroup, KindToggle, Sheet, TagPicker } from '../../ui/kit';
import { IconClose, IconPlay } from '../../ui/icons';

export function QuickAdd() {
  const tab = quickAdd.use();
  return (
    <Sheet open={tab !== null} onClose={closeQuickAdd} label="Quick add">
      {tab && <Body initial={tab} />}
    </Sheet>
  );
}

function Body({ initial }: { initial: AddTab }) {
  const [tab, setTab] = useState<AddTab>(initial);
  const tabs: { id: AddTab; label: string }[] = [{ id: 'spend', label: 'Spend' }, { id: 'time', label: 'Time' }, { id: 'task', label: 'Task' }];
  return (
    <>
      <div className="row" style={{ gap: 8 }}>
        <div className="tabs" role="tablist" aria-label="What are you adding?">
          {tabs.map((t) => (
            <button key={t.id} role="tab" type="button" data-skip-focus aria-selected={tab === t.id} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </div>
        <button type="button" className="icon-btn" aria-label="Close" data-skip-focus onClick={closeQuickAdd}><IconClose size={20} /></button>
      </div>
      {tab === 'spend' && <SpendForm />}
      {tab === 'time' && <TimeForm />}
      {tab === 'task' && <TaskForm />}
    </>
  );
}

function SpendForm() {
  const data = useData();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<SpendKind | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [day, setDay] = useState(todayISO());
  const [error, setError] = useState('');
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'];

  const save = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    if (cents === null) return setError('Type an amount first.');
    if (!kind) return setError('Pick need or want.');
    actions.addExpense({ amount: cents, note: note.trim(), kind, tags, day });
    showToast(`Added ${fmtMoney(cents)} · ${kind}`);
    closeQuickAdd();
  };

  return (
    <form onSubmit={save} className="stack" style={{ gap: 12 }}>
      <label htmlFor="qa-amount" className="sr-only">Amount in dollars</label>
      <input
        id="qa-amount" className="num amount" inputMode="decimal" value={amount ? `$${amount}` : ''} placeholder="$0"
        onChange={(e) => { setError(''); setAmount(e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')); }}
        style={{ border: 'none', background: 'transparent', width: '100%', color: 'var(--ink)' }}
      />
      <div className="keypad" aria-label="Keypad">
        {keys.map((k) => (
          <button key={k} type="button" aria-label={k === 'del' ? 'Delete' : k === '.' ? 'Decimal point' : k} onClick={() => { setError(''); setAmount((a) => pressKey(a, k)); }}>
            {k === 'del' ? '⌫' : k}
          </button>
        ))}
      </div>
      <div className={error === 'Pick need or want.' ? 'missing-wrap' : ''}>
        <KindToggle value={kind} onChange={(k) => { setKind(k); setError(''); }} />
      </div>
      <label className="inline-input" htmlFor="qa-note">
        <span className="small muted">For</span>
        <input id="qa-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Lunch · Mugi Café" />
      </label>
      <TagPicker id="qa-tag" value={tags} onChange={setTags} suggestions={moneyTags(data.expenses)} />
      <div className="row" style={{ gap: 8 }}>
        <button type="button" className="chip" aria-pressed={day === todayISO()} onClick={() => setDay(todayISO())}>Today</button>
        <button type="button" className="chip" aria-pressed={day === addDays(todayISO(), -1)} onClick={() => setDay(addDays(todayISO(), -1))}>Yesterday</button>
        <label htmlFor="qa-day" className="sr-only">Day</label>
        <input id="qa-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} style={{ minHeight: 36, border: '1.5px solid var(--line)', borderRadius: 18, padding: '0 10px', background: 'var(--card)', color: 'var(--ink)' }} />
      </div>
      {error && <p className="warn small" role="alert">{error}</p>}
      <button type="submit" className="btn primary block">Add expense</button>
    </form>
  );
}

function TimeForm() {
  const data = useData();
  const recent = recentActivities(data.entries, 4);
  const [label, setLabel] = useState('');
  const [categoryId, setCategoryId] = useState(data.timeCategories[0]?.id ?? '');
  const nowMin = Math.floor(minutesOfDay(Date.now()) / 15) * 15;
  const [day, setDay] = useState(todayISO());
  const [from, setFrom] = useState(toTimeInput(Math.max(0, nowMin - 60)));
  const [to, setTo] = useState(toTimeInput(nowMin));
  const [error, setError] = useState('');
  const catName = (id: string) => data.timeCategories.find((c) => c.id === id)?.name ?? '';

  const start = () => {
    actions.startTimer(label, categoryId);
    showToast(`Timer started${label ? ` · ${label}` : ''}`);
    closeQuickAdd();
  };

  const log = (e: FormEvent) => {
    e.preventDefault();
    const s = fromTimeInput(from);
    const t = fromTimeInput(to);
    if (s === null || t === null || t <= s) return setError('The end time needs to be after the start time.');
    actions.addEntry({ label: label.trim(), categoryId, start: msAt(day, s), end: msAt(day, t) });
    showToast(`Logged ${label || catName(categoryId)}`);
    closeQuickAdd();
  };

  return (
    <form onSubmit={log} className="stack" style={{ gap: 12 }}>
      <label className="inline-input" htmlFor="qa-label">
        <span className="small muted">Doing</span>
        <input id="qa-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Reading · COMP2521" autoComplete="off" />
      </label>
      {recent.length > 0 && (
        <div className="chips" aria-label="Recent activities">
          {recent.map((r) => (
            <button key={r.label + r.categoryId} type="button" className="chip" style={{ minHeight: 32, fontSize: 12 }} onClick={() => { setLabel(r.label); setCategoryId(r.categoryId); }}>{r.label}</button>
          ))}
        </div>
      )}
      <ChipGroup label="Category" value={categoryId} onChange={setCategoryId} options={data.timeCategories.map((c) => ({ value: c.id, label: c.name, color: c.color }))} />
      <button type="button" className="btn green block" style={{ minHeight: 64, fontSize: 16 }} onClick={start}><IconPlay size={18} /> Start timer now</button>
      <p className="small muted" style={{ textAlign: 'center' }}>or log a block you already did</p>
      <div className="grid2" style={{ gridTemplateColumns: '1.3fr 1fr 1fr' }}>
        <label className="field" htmlFor="qa-tday">Day<input id="qa-tday" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
        <label className="field" htmlFor="qa-from">From<input id="qa-from" type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="field" htmlFor="qa-to">To<input id="qa-to" type="time" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {error && <p className="warn small" role="alert">{error}</p>}
      <button type="submit" className="btn primary block">Log block</button>
    </form>
  );
}

function TaskForm() {
  const data = useData();
  const today = todayISO();
  const [text, setText] = useState('');
  const [listId, setListId] = useState(data.lists[0]?.id ?? '');
  const [priority, setPriority] = useState<Priority>(0);
  const [due, setDue] = useState<string>(today);
  const parsed = parseTaskInput(text);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!parsed.title) return;
    actions.addTask({ title: parsed.title, tags: parsed.tags, priority: Math.max(priority, parsed.priority) as Priority, listId, due: due || null });
    showToast('Task added');
    closeQuickAdd();
  };

  const dues = [{ label: 'Today', value: today }, { label: 'Tomorrow', value: addDays(today, 1) }, { label: 'Next week', value: addDays(today, 7) }, { label: 'No date', value: '' }];

  return (
    <form onSubmit={save} className="stack" style={{ gap: 12 }}>
      <label className="inline-input" htmlFor="qa-task">
        <span className="small muted">Task</span>
        <input id="qa-task" value={text} onChange={(e) => setText(e.target.value)} placeholder="Print lab cover sheet #lab4" />
      </label>
      {parsed.tags.length > 0 && <p className="small muted">Tags: {parsed.tags.map((t) => `#${t}`).join(' ')}</p>}
      <p className="label">List</p>
      <ChipGroup label="List" value={listId} onChange={setListId} options={data.lists.map((l) => ({ value: l.id, label: l.name }))} />
      <p className="label">Priority</p>
      <ChipGroup<'0' | '1' | '2'> label="Priority" value={String(priority) as '0' | '1' | '2'} onChange={(v) => setPriority(Number(v) as Priority)} options={[{ value: '0', label: 'Normal' }, { value: '1', label: '! Soon' }, { value: '2', label: '!! Important' }]} />
      <p className="label">Due</p>
      <div className="chips">
        {dues.map((d) => <button key={d.label} type="button" className="chip" aria-pressed={due === d.value} onClick={() => setDue(d.value)}>{d.label}</button>)}
      </div>
      <button type="submit" className="btn primary block" disabled={!parsed.title}>Add task</button>
    </form>
  );
}
