// The whole app's data. Everything is stored locally on the device.

export type ID = string;
/** Local calendar day, "YYYY-MM-DD". */
export type Day = string;

export interface TimeCategory {
  id: ID;
  name: string;
  color: string;
  /** Drawn as a thin arrow in its own lane instead of a block, like travel in a paper planner. */
  arrow?: boolean;
}

/** Every expense is either a need or a want. */
export type SpendKind = 'need' | 'want';

/** Where a block of time came from. `device` is reserved for syncing phone activity later. */
export type EntrySource = 'paint' | 'timer' | 'manual' | 'plan' | 'device';

/** A logged block of time. `end === null` means the timer is still running. */
export interface TimeEntry {
  id: ID;
  /** Optional note; painted blocks start with no label and show the activity name. */
  label: string;
  categoryId: ID;
  start: number;
  end: number | null;
  source?: EntrySource;
  /** The planned block this was filled in from, if any. That plan then counts as done. */
  planId?: ID;
  /** For phone use approved from a suggestion: which suggestion it was. */
  deviceKey?: string;
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

/** One block of a day template, in minutes after midnight. */
export interface TemplateBlock {
  label: string;
  categoryId: ID;
  startMin: number;
  endMin: number;
}

/** A reusable day plan ("Uni day") that repeats on chosen weekdays. */
export interface DayTemplate {
  id: ID;
  name: string;
  /** 0 = Monday … 6 = Sunday. Each weekday follows at most one template. */
  weekdays: number[];
  blocks: TemplateBlock[];
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
  /** Icon name (see data/icons.ts). */
  icon: string;
}

/** A folder in More. Task folders are the task lists in `lists`; every other kind lives in `folders`. */
export type FolderType = 'tracker' | 'check' | 'collect' | 'wish';

export interface Folder {
  id: ID;
  name: string;
  icon: string;
  type: FolderType;
}

export type RepeatUnit = 'day' | 'week' | 'month';

/**
 * Something in a tracker folder. "since" counts days since it last happened (habits to avoid);
 * "every" repeats and shows when it's next due (chores, habits to keep up).
 */
export interface TrackerItem {
  id: ID;
  folderId: ID;
  name: string;
  icon: string;
  kind: 'since' | 'every';
  every?: { n: number; unit: RepeatUnit };
  /** For monthly repeats: due on this day of the month (1–31) instead of a month after last time. */
  onDay?: number;
  /** Days it happened or was done, oldest first. */
  hits: Day[];
  /** The day it was added, so a new repeat isn't due straight away. */
  since: Day;
  pinned?: boolean;
}

/** Something in a checklist, collection or wishlist folder. */
export interface ListItem {
  id: ID;
  folderId: ID;
  text: string;
  done?: boolean;
  status?: 'want' | 'doing' | 'done';
  stars?: number;
  /** Wishlist price in cents. */
  price?: number;
  createdAt: number;
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

/** Phone tracking, in the Android app: long stretches of phone use become suggested blocks. */
export interface PhoneSettings {
  enabled: boolean;
  /** Shortest stretch of phone use, in minutes, that becomes a suggestion. */
  minMin: number;
  /** Gaps shorter than this many minutes join two stretches into one. */
  gapMin: number;
  /** Activity for apps without their own setting, or null to not count them. */
  defaultCategoryId: ID | null;
  /** Per app (Android package name): the activity it counts as, or null to not count it. */
  apps: Record<string, ID | null>;
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
  phone: PhoneSettings;
}

export interface AppData {
  version: 2;
  /** True while the app is showing the example week instead of the person's own data. */
  example: boolean;
  timeCategories: TimeCategory[];
  entries: TimeEntry[];
  planned: PlannedBlock[];
  templates: DayTemplate[];
  /** Days with their own plan in `planned`. Every other day shows its weekday's template. */
  planDays: Day[];
  /** Phone-use suggestions you dismissed, so they don't come back. */
  phoneDismissed: string[];
  milestones: Milestone[];
  expenses: Expense[];
  bills: Bill[];
  lists: TaskList[];
  tasks: Task[];
  folders: Folder[];
  trackers: TrackerItem[];
  listItems: ListItem[];
  settings: Settings;
}
