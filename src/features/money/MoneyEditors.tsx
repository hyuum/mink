// Sheets for editing an expense, a recurring bill and the weekly allowance.
import { useState, type FormEvent } from 'react';
import { actions, useData } from '../../data/store';
import type { Cadence, ID, SpendKind } from '../../data/types';
import { moneyTags } from '../../data/logic';
import { fmtMoney, parseAmount } from '../../lib/money';
import { todayISO } from '../../lib/dates';
import { ChipGroup, KindToggle, Sheet, TagPicker } from '../../ui/kit';
import { showToast } from '../../app/ui-state';

const centsToInput = (c: number) => (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));

export function ExpenseEditor({ id, onClose }: { id: ID | null; onClose: () => void }) {
  return (
    <Sheet open={id !== null} onClose={onClose} label="Edit expense">
      {id && <ExpenseBody key={id} id={id} onClose={onClose} />}
    </Sheet>
  );
}

function ExpenseBody({ id, onClose }: { id: ID; onClose: () => void }) {
  const data = useData();
  const ex = data.expenses.find((e) => e.id === id);
  const [amount, setAmount] = useState(ex ? centsToInput(ex.amount) : '');
  const [note, setNote] = useState(ex?.note ?? '');
  const [kind, setKind] = useState<SpendKind>(ex?.kind ?? 'need');
  const [tags, setTags] = useState<string[]>(ex?.tags ?? []);
  const [day, setDay] = useState(ex?.day ?? todayISO());
  const [error, setError] = useState('');
  if (!ex) return null;

  const save = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    if (cents === null) return setError('Enter an amount, like 12.50.');
    actions.updateExpense(id, { amount: cents, note: note.trim(), kind, tags, day });
    showToast('Expense updated');
    onClose();
  };

  return (
    <form onSubmit={save} className="stack" style={{ gap: 14 }}>
      <h2>Edit expense</h2>
      <div className="grid2">
        <label className="field" htmlFor="ex-amount">Amount ($)<input id="ex-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label className="field" htmlFor="ex-day">Day<input id="ex-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} /></label>
      </div>
      <label className="field" htmlFor="ex-note">For<input id="ex-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Groceries · Coles" /></label>
      <KindToggle value={kind} onChange={setKind} />
      <p className="label">Tags (optional)</p>
      <TagPicker id="ex-tag" value={tags} onChange={setTags} suggestions={moneyTags(data.expenses)} />
      {error && <p className="warn small" role="alert">{error}</p>}
      <button type="submit" className="btn primary block">Save</button>
      <div className="row">
        <button type="button" className="btn danger" onClick={() => { showToast('Expense deleted', actions.deleteExpense(id)); onClose(); }}>Delete</button>
        <button type="button" className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

const CADENCES: { value: Cadence; label: string }[] = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

export function BillEditor({ id, onClose }: { id: ID | 'new' | null; onClose: () => void }) {
  return (
    <Sheet open={id !== null} onClose={onClose} label="Recurring bill">
      {id && <BillBody key={id} id={id} onClose={onClose} />}
    </Sheet>
  );
}

function BillBody({ id, onClose }: { id: ID | 'new'; onClose: () => void }) {
  const data = useData();
  const bill = id === 'new' ? undefined : data.bills.find((b) => b.id === id);
  const [name, setName] = useState(bill?.name ?? '');
  const [amount, setAmount] = useState(bill ? centsToInput(bill.amount) : '');
  const [kind, setKind] = useState<SpendKind | null>(bill?.kind ?? null);
  const [tags, setTags] = useState<string[]>(bill?.tags ?? ['bills']);
  const [cadence, setCadence] = useState<Cadence>(bill?.cadence ?? 'monthly');
  const [nextDue, setNextDue] = useState(bill?.nextDue ?? todayISO());
  const [error, setError] = useState('');

  const save = (e: FormEvent) => {
    e.preventDefault();
    const cents = parseAmount(amount);
    if (!name.trim()) return setError('Give the bill a name.');
    if (cents === null) return setError('Enter an amount, like 35.');
    if (!kind) return setError('Pick need or want.');
    const value = { name: name.trim(), amount: cents, kind, tags, cadence, nextDue };
    if (bill) actions.updateBill(bill.id, value);
    else actions.addBill(value);
    showToast(bill ? 'Bill updated' : 'Bill added');
    onClose();
  };

  return (
    <form onSubmit={save} className="stack" style={{ gap: 14 }}>
      <h2>{bill ? 'Edit bill' : 'New recurring bill'}</h2>
      <label className="field" htmlFor="bill-name">Name<input id="bill-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Phone plan" /></label>
      <div className="grid2">
        <label className="field" htmlFor="bill-amount">Amount ($)<input id="bill-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label className="field" htmlFor="bill-due">Next due<input id="bill-due" type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} /></label>
      </div>
      <p className="label">Repeats</p>
      <ChipGroup label="Repeats" value={cadence} onChange={setCadence} options={CADENCES} />
      <KindToggle value={kind} onChange={setKind} />
      <p className="label">Tags (optional)</p>
      <TagPicker id="bill-tag" value={tags} onChange={setTags} suggestions={moneyTags(data.expenses)} />
      <p className="small muted">Paying a bill logs it as spending that week, so it counts toward your allowance.</p>
      {error && <p className="warn small" role="alert">{error}</p>}
      <button type="submit" className="btn primary block">Save</button>
      <div className="row">
        {bill && <button type="button" className="btn danger" onClick={() => { showToast('Bill deleted', actions.deleteBill(bill.id)); onClose(); }}>Delete</button>}
        <button type="button" className="btn ghost" style={{ marginLeft: 'auto' }} onClick={onClose}>Cancel</button>
      </div>
    </form>
  );
}

export function AllowanceEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} label="Weekly allowance">
      {open && <AllowanceBody onClose={onClose} />}
    </Sheet>
  );
}

function AllowanceBody({ onClose }: { onClose: () => void }) {
  const data = useData();
  const [value, setValue] = useState(centsToInput(data.settings.weeklyAllowance));
  const [error, setError] = useState('');
  const cents = parseAmount(value);

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (cents === null) return setError('Enter an amount, like 250.');
    actions.updateSettings({ weeklyAllowance: cents });
    showToast(`Weekly allowance set to ${fmtMoney(cents)}`);
    onClose();
  };

  return (
    <form onSubmit={save} className="stack" style={{ gap: 12 }}>
      <h2>Weekly allowance</h2>
      <p className="small muted">How much you want to spend Monday to Sunday, bills included.</p>
      <label className="field" htmlFor="allowance">Each week ($)<input id="allowance" inputMode="decimal" value={value} onChange={(e) => { setValue(e.target.value); setError(''); }} /></label>
      {cents !== null && <p className="small muted">That's {fmtMoney(cents * 4)} a month (4 weeks) and about {fmtMoney(Math.floor(cents / 7))} a day.</p>}
      {error && <p className="warn small" role="alert">{error}</p>}
      <button type="submit" className="btn primary block">Save</button>
      <button type="button" className="btn ghost" onClick={onClose}>Cancel</button>
    </form>
  );
}
