import { useState, type FormEvent } from 'react';
import { actions, useData } from '../../data/store';
import { normaliseTags } from '../../data/logic';
import type { ID, Priority } from '../../data/types';
import { addDays, todayISO } from '../../lib/dates';
import { ChipGroup, Sheet } from '../../ui/kit';
import { showToast } from '../../app/ui-state';

export function TaskEditor({ id, onClose }: { id: ID | null; onClose: () => void }) {
  return (
    <Sheet open={id !== null} onClose={onClose} label="Edit task">
      {id && <Body key={id} id={id} onClose={onClose} />}
    </Sheet>
  );
}

function Body({ id, onClose }: { id: ID; onClose: () => void }) {
  const data = useData();
  const task = data.tasks.find((t) => t.id === id);
  const today = todayISO();
  const [title, setTitle] = useState(task?.title ?? '');
  const [listId, setListId] = useState(task?.listId ?? '');
  const [priority, setPriority] = useState<Priority>(task?.priority ?? 0);
  const [due, setDue] = useState(task?.due ?? '');
  const [tags, setTags] = useState(task?.tags.map((t) => `#${t}`).join(' ') ?? '');
  if (!task) return null;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    actions.updateTask(id, { title: title.trim(), listId, priority, due: due || null, tags: normaliseTags(tags) });
    showToast('Task saved');
    onClose();
  };

  const quick = [
    { label: 'Today', value: today },
    { label: 'Tomorrow', value: addDays(today, 1) },
    { label: 'Next week', value: addDays(today, 7) },
    { label: 'No date', value: '' },
  ];

  return (
    <form onSubmit={save} className="stack" style={{ gap: 14 }}>
      <h2>Edit task</h2>
      <label className="field" htmlFor="task-title">Task<input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} /></label>
      <p className="label">List</p>
      <ChipGroup label="List" value={listId} onChange={setListId} options={data.lists.map((l) => ({ value: l.id, label: l.name }))} />
      <p className="label">Priority</p>
      <ChipGroup<'0' | '1' | '2'> label="Priority" value={String(priority) as '0' | '1' | '2'} onChange={(v) => setPriority(Number(v) as Priority)} options={[{ value: '0', label: 'Normal' }, { value: '1', label: '! Soon' }, { value: '2', label: '!! Important' }]} />
      <p className="label">Due</p>
      <div className="chips">
        {quick.map((q) => (
          <button key={q.label} type="button" className="chip" aria-pressed={due === q.value} onClick={() => setDue(q.value)}>{q.label}</button>
        ))}
      </div>
      <label className="field" htmlFor="task-due">Or pick a date<input id="task-due" type="date" value={due} onChange={(e) => setDue(e.target.value)} /></label>
      <label className="field" htmlFor="task-tags">Tags<input id="task-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#exam #reading" autoCapitalize="none" /></label>
      <button type="submit" className="btn primary block">Save</button>
      <div className="row">
        <button type="button" className="btn danger" onClick={() => { showToast('Task deleted', actions.deleteTask(id)); onClose(); }}>Delete</button>
        <button type="button" className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}
