import dayjs from 'dayjs';

export interface DutyConfig {
  type: 'lab' | 'office';
  people: string[];
  rotation_period: number;
  ref_date: string; // ISO date string
}

export interface DutyOverride {
  id?: string;
  type: 'lab' | 'office';
  target_date: string;
  people: string[];
}

/**
 * Get the Monday of the week containing the given date
 */
export function getMonday(date: Date): Date {
  const d = dayjs(date);
  const dow = d.day(); // 0=Sun, 1=Mon, ...
  const diff = dow === 0 ? -6 : 1 - dow;
  return d.add(diff, 'day').startOf('day').toDate();
}

/**
 * Calculate lab duty schedule for a given week (Mon-Fri)
 * Returns array of 5 names [Mon, Tue, Wed, Thu, Fri]
 *
 * Logic:
 * 1. Check if there's an override for this week's Monday
 * 2. If override exists, return override.people
 * 3. Otherwise calculate:
 *    - weeks = floor((targetMonday - refMonday) / 7)
 *    - offset = floor(weeks / rotation_period) % people.length
 *    - Rotate the assignment: person for day i = people[((i - offset) % len + len) % len]
 */
export function getLabWeekSchedule(
  config: DutyConfig,
  overrides: DutyOverride[],
  targetMonday: Date,
): string[] {
  const mondayStr = dayjs(targetMonday).format('YYYY-MM-DD');

  // Check for override
  const override = overrides.find(
    (o) => o.type === 'lab' && o.target_date === mondayStr,
  );
  if (override && override.people.length === 5) {
    return override.people;
  }

  const { people, rotation_period, ref_date } = config;
  if (people.length === 0) return ['', '', '', '', ''];

  const refMonday = getMonday(new Date(ref_date));
  const diffDays = dayjs(targetMonday).diff(dayjs(refMonday), 'day');
  const diffWeeks = Math.floor(diffDays / 7);
  const rotationCount = Math.floor(diffWeeks / rotation_period);
  const len = people.length;

  return [0, 1, 2, 3, 4].map(
    (i) => people[(((i - rotationCount) % len) + len) % len],
  );
}

/**
 * Get today's lab duty person (null on weekends)
 */
export function getLabDutyToday(
  config: DutyConfig,
  overrides: DutyOverride[],
): string | null {
  const now = new Date();
  const dow = now.getDay();
  if (dow === 0 || dow === 6) return null;

  const monday = getMonday(now);
  const schedule = getLabWeekSchedule(config, overrides, monday);
  return schedule[dow - 1] ?? null;
}

/**
 * Get office duty person for a given month
 *
 * Logic:
 * 1. Check if there's an override for this month's 1st
 * 2. If override exists, return override.people[0]
 * 3. Otherwise calculate:
 *    - months = (targetYear - refYear) * 12 + (targetMonth - refMonth)
 *    - index = floor(months / rotation_period) % people.length
 *    - Return people[index]
 */
export function getOfficeDutyThisMonth(
  config: DutyConfig,
  overrides: DutyOverride[],
  targetDate?: Date,
): string {
  const now = targetDate ?? new Date();
  const targetYear = now.getFullYear();
  const targetMonth = now.getMonth(); // 0-based

  const firstOfMonth = dayjs(new Date(targetYear, targetMonth, 1)).format('YYYY-MM-DD');

  // Check for override
  const override = overrides.find(
    (o) => o.type === 'office' && o.target_date === firstOfMonth,
  );
  if (override && override.people.length > 0) {
    return override.people[0];
  }

  const { people, rotation_period, ref_date } = config;
  if (people.length === 0) return '';

  const refD = new Date(ref_date);
  const refYear = refD.getFullYear();
  const refMonth = refD.getMonth();

  const monthDiff = (targetYear - refYear) * 12 + (targetMonth - refMonth);
  const index = Math.floor(monthDiff / rotation_period);
  const len = people.length;

  return people[((index % len) + len) % len];
}
