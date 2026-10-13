// The whole app's data. Everything is stored locally on the device.

export type ID = string;
/** Local calendar day, "YYYY-MM-DD". */
export type Day = string;

export interface TimeCategory {
  id: ID;
  name: string;
  color: string;
}

/** Every expense is either a need or a want. */
export type SpendKind = 'need' | 'want';

/** Where a block of time came from. `device` is reserved for syncing phone activity later. */
export type EntrySource = 'paint' | 'timer' | 'manual' | 'device';

/** A logged block of time. `end === null` means the timer is still running. */
export interface TimeEntry {
  id: ID;
  /** Optional note; painted blocks start with no label and show the activity name. */
  label: string;
  categoryId: ID;
  start: number;
  end: number | null;
  source?: EntrySource;
}

/** A block planned on the timeline but not logged yet. */
export interface PlannedBlock {
  id: ID;
  label: string;
  categoryId: ID;
  day: Day;
  /** Minutes after midnight. */
  startMin: number;
  endMin: number;
}

export type MilestoneKind = 'wake' | 'leave' | 'arrive' | 'lunch' | 'home' | 'bed' | 'custom';

/** A moment in the day (wake up, leave home, bed…). Sits on top of painted time and never replaces it. */
export interface Milestone {
  id: ID;
  kind: MilestoneKind;
  /** Only used for custom milestones; built-in kinds show their own name. */
  label: string;
  /** The day it belongs to. Bed after midnight still belongs to the evening before. */
  day: Day;
  /** Minutes after that day's midnight; can go past 1440 (e.g. bed at 12:30 am = 1470). */
  min: number;
}

export interface Expense {
  id: ID;
  /** Cents, always positive. */
  amount: number;
  kind: SpendKind;
  /** Optional free tags, lower case, no "#". */
  tags: string[];
  note: string;
  day: Day;
  billId?: ID;
  createdAt: number;
}

export type Cadence = 'weekly' | 'fortnightly' | 'monthly' | 'yearly';

export interface Bill {
  id: ID;
  name: string;
  amount: number;
  kind: SpendKind;
  tags: string[];
  cadence: Cadence;
  nextDue: Day;
}

export interface TaskList {
  id: ID;
  name: string;
}

export type Priority = 0 | 1 | 2;

export interface Task {
  id: ID;
  title: string;
  listId: ID;
  tags: string[];
  priority: Priority;
  due: Day | null;
  done: boolean;
  doneAt: number | null;
  createdAt: number;
}

export interface Settings {
  /** First and last hour shown on the day timeline. */
  dayStartHour: number;
  dayEndHour: number;
  /** Daily time goal in minutes; 0 hides the goal. */
  dailyGoalMin: number;
  /** Spending allowance per Monday–Sunday week, in cents. A month's allowance is 4 × this. */
  weeklyAllowance: number;
  stickers: boolean;
  theme: 'system' | 'light' | 'dark';
}

export interface AppData {
  version: 2;
  /** True while the app is showing the example week instead of the person's own data. */
  example: boolean;
  timeCategories: TimeCategory[];
  entries: TimeEntry[];
  planned: PlannedBlock[];
  milestones: Milestone[];
  expenses: Expense[];
  bills: Bill[];
  lists: TaskList[];
  tasks: Task[];
  settings: Settings;
}
