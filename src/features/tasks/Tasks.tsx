import { useEffect, useState, type FormEvent } from 'react';
import { actions, useData } from '../../data/store';
import { allTags, groupTasks, parseTaskInput } from '../../data/logic';
import { relativeDay, todayISO } from '../../lib/dates';
import { moreView, taskListFilter, useNow, go } from '../../app/ui-state';
import { Band, CheckBox } from '../../ui/kit';
import { IconPlus } from '../../ui/icons';
import { TaskEditor } from './TaskEditor';

export function Tasks() {
  const data = useData();
  const now = useNow(60_000);
  const today = todayISO(now);
  // Opened from a task folder in More: start on that list, with a way back.
  const [fromMore] = useState(() => taskListFilter.get() !== null);
  const [list, setList] = useState<string>(() => taskListFilter.get() ?? 'all');
  useEffect(() => { taskListFilter.set(null); }, []);
  const [tag, setTag] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [edit, setEdit] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [addingList, setAddingList] = useState(false);
  const [listName, setListName] = useState('');

  const inList = data.tasks.filter((t) => list === 'all' || t.listId === list);
  const tags = allTags(inList);
  const shown = inList.filter((t) => !tag || t.tags.includes(tag));
  const groups = groupTasks(shown, today);
  const dueToday = data.tasks.filter((t) => !t.done && t.due !== null && t.due <= today).length;
  const listName_ = (id: string) => data.lists.find((l) => l.id === id)?.name ?? '';
  const currentList = list === 'all' ? null : data.lists.find((l) => l.id === list);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseTaskInput(text);
    if (!parsed.title) return;
    actions.addTask({ ...parsed, tags: Array.from(new Set([...parsed.tags, ...(tag ? [tag] : [])])), listId: currentList?.id ?? data.lists[0]?.id ?? 'personal' });
    setText('');
  };

  const addList = (e: FormEvent) => {
    e.preventDefault();
    if (listName.trim()) actions.addList(listName.trim());
    setListName('');
    setAddingList(false);
  };

  return (
    <>
      <Band>
        {fromMore && <button type="button" className="backlink" onClick={() => { moreView.set({ kind: 'hub' }); go('more'); }}>‹ More</button>}
        <div className="band-row">
          <h1>Tasks</h1>
          <span className="band-sub">{dueToday === 0 ? 'Nothing due today' : `${dueToday} due today`}</span>
        </div>
        <div className="band-chips" role="tablist" aria-label="Lists">
          {[{ id: 'all', name: 'All' }, ...data.lists].map((l) => (
            <button key={l.id} role="tab" className="chip" aria-selected={list === l.id} onClick={() => { setList(l.id); setTag(null); }}>
              {l.name} <span style={{ opacity: 0.7 }}>{(l.id === 'all' ? data.tasks : data.tasks.filter((t) => t.listId === l.id)).filter((t) => !t.done).length}</span>
            </button>
          ))}
          <button className="chip" onClick={() => setAddingList(true)}>+ List</button>
        </div>
        {addingList && (
          <form className="row" onSubmit={addList}>
            <label htmlFor="new-list" className="sr-only">New list name</label>
            <input id="new-list" autoFocus value={listName} onChange={(e) => setListName(e.target.value)} placeholder="New list name" style={{ flex: 1, minHeight: 40, borderRadius: 12, border: 'none', padding: '0 12px', fontSize: 16, background: 'var(--card)', color: 'var(--ink)' }} />
            <button className="btn" type="submit">Add</button>
            <button className="btn" type="button" onClick={() => setAddingList(false)}>Cancel</button>
          </form>
        )}
      </Band>

      <div className="content">
        <section className="card" style={{ paddingBottom: 8 }}>
          <form onSubmit={add} className="inline-input">
            <label htmlFor="new-task" className="sr-only">New task</label>
            <input id="new-task" value={text} onChange={(e) => setText(e.target.value)} placeholder={`Add to ${currentList?.name ?? listName_(data.lists[0]?.id ?? '')}…  #tag  !!`} enterKeyHint="done" />
            <button className="icon-btn" type="submit" aria-label="Add task"><IconPlus size={20} /></button>
          </form>

          {tags.length > 0 && (
            <div className="chips" style={{ marginTop: 10 }} aria-label="Filter by tag">
              {tags.map((t) => (
                <button key={t} className="chip" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)} style={{ minHeight: 32, fontSize: 12 }}>#{t}</button>
              ))}
            </div>
          )}

          {groups.length === 0 && <p className="empty">{tag ? `No tasks tagged #${tag}.` : 'No tasks here yet. Add one above.'}</p>}

          {groups.map((g) => {
            if (g.key === 'done' && !showDone) {
              return (
                <button key="done" className="card-link" style={{ marginTop: 10 }} onClick={() => setShowDone(true)}>
                  Show {g.tasks.length} done
                </button>
              );
            }
            return (
              <div key={g.key}>
                <h2 className={`group-label ${g.key === 'done' || g.key === 'someday' ? 'green' : ''}`}>{g.label}</h2>
                <ul className="items">
                  {(g.key === 'done' ? g.tasks.slice(0, 20) : g.tasks).map((t) => {
                    const meta = [list === 'all' ? listName_(t.listId) : '', t.due && g.key !== 'today' ? relativeDay(t.due, today) : ''].filter(Boolean).join(' · ');
                    return (
                      <li key={t.id} className={`item ${t.done ? 'is-done' : ''}`}>
                        <CheckBox checked={t.done} onChange={() => actions.toggleTask(t.id)} label={`${t.done ? 'Mark not done' : 'Mark done'}: ${t.title}`} />
                        <button className="item-main" onClick={() => setEdit(t.id)}>
                          <p className="item-title">{t.title} {t.priority > 0 && !t.done && <span className="prio">{'!'.repeat(t.priority)}</span>}</p>
                          {(meta || t.tags.length > 0) && (
                            <p className={`item-meta ${g.key === 'overdue' ? 'warn' : ''}`}>
                              {meta}
                              {t.tags.map((x) => <span key={x} className="tag" style={{ marginLeft: meta ? 6 : 0, marginRight: 4 }}>#{x}</span>)}
                            </p>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {g.key === 'done' && <button className="card-link" onClick={() => setShowDone(false)}>Hide done</button>}
              </div>
            );
          })}
        </section>
        <p className="small muted" style={{ padding: '0 4px' }}>Tip: type #tags and ! or !! while adding. Tap a task to set a due date, list or priority.</p>
      </div>
      <TaskEditor id={edit} onClose={() => setEdit(null)} />
    </>
  );
}
