// What changed in each app update, newest first. Each line is "New: …", "Fix: …" or "Change: …" and a few words. The app shows the entries you haven't
// seen yet once after updating (see WhatsNew). Add an entry with the next id for every release.
export interface ChangeEntry { id: number; date: string; items: string[] }

export const CHANGELOG: ChangeEntry[] = [
  { id: 10, date: '17 Nov', items: ['New: phone use history'] },
  { id: 9, date: '17 Nov', items: ['New: update notes', 'Change: filled blocks stay selected'] },
  { id: 8, date: '14 Nov', items: ['New: notification history', 'Fix: ClassPass receipts missed', 'New: hide tags in stats', 'Change: needs/wants tucked away'] },
  { id: 7, date: '11 Nov', items: ['New: money stats', 'New: paint brush', 'New: blocks snap to neighbours', 'New: add activity from picker'] },
  { id: 6, date: '10 Nov', items: ['Fix: blocks couldn\'t run past midnight', 'Fix: + showing in sleep', 'Change: phone blocks snap to 15 min', 'New: hold to approve phone blocks', 'New: tags in spend review'] },
];

export const LATEST_CHANGE = CHANGELOG[0].id;
