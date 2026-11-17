// What changed in each app update, newest first, in plain words. The app shows the entries you haven't
// seen yet once after updating (see WhatsNew). Add an entry with the next id for every release.
export interface ChangeEntry { id: number; date: string; items: string[] }

export const CHANGELOG: ChangeEntry[] = [
  {
    id: 9, date: '17 Nov',
    items: [
      'A "What\'s new" note like this one after each update. Reopen it any time from Settings › App and data.',
      'Holding a phone-use or planned block until it fills now leaves the new block selected, so you can resize or change it straight away.',
    ],
  },
  {
    id: 8, date: '14 Nov',
    items: [
      'Spend tracking › Notification history: every notification kept from your ticked apps, with what happened to it and why. Dismissed ones can go back up for review.',
      'Receipts like ClassPass\'s ("payment … was successful", renewals, fees) are now picked up, and named after the app.',
      'Stats: hide tags (like rent) from the Tags button; needs and wants moved into a section you can open.',
    ],
  },
  {
    id: 7, date: '11 Nov',
    items: [
      'Money › Stats with Week, Month and All time: where the money went by tag, each week as a line, top places and biggest spends.',
      'Paint brush: tap Paint on the day, pick an activity, and drag to paint with no picker.',
      'Painted, moved and resized blocks snap to the edge of the block next to them.',
      '"+ New activity" in the picker makes an activity on the spot.',
    ],
  },
  {
    id: 6, date: '10 Nov',
    items: [
      'Phone-use blocks line up with the quarter hours; hold one to approve it.',
      'Blocks can run past midnight, and the day stretches to show them.',
      'Add tags to spends right in the spend review.',
      'No + buttons in your sleep.',
    ],
  },
];

export const LATEST_CHANGE = CHANGELOG[0].id;
