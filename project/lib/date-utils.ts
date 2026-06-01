/**
 * Returns the calendar month (YYYY-MM) in which the current date falls,
 * ignoring any payday adjustments. Used to identify which month's income
 * receipt we should be looking for.
 */
export function getCalendarMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Returns the effective reference month for the default dashboard view.
 *
 * When paydayStart is set, the financial month doesn't start until the user
 * receives their salary. Before payday (or after payday but before confirming
 * receipt), the previous month is still the active month.
 */
export function getEffectiveCurrentMonth(
  paydayStart: number | null,
  incomeConfirmedForCalendarMonth: boolean,
): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();

  const calendarMonth = `${year}-${String(month).padStart(2, "0")}`;

  if (!paydayStart) return calendarMonth;

  // Still before payday OR payday arrived but not yet confirmed → previous month
  if (day < paydayStart || !incomeConfirmedForCalendarMonth) {
    const prev = new Date(Date.UTC(year, month - 2, 1));
    return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}`;
  }

  return calendarMonth;
}

export function getPaydayMonthRange(
  referenceMonth: string,
  paydayStart: number | null,
): { start: Date; end: Date } {
  const [year, month] = referenceMonth.split("-").map(Number);

  if (!paydayStart) {
    return {
      start: new Date(Date.UTC(year, month - 1, 1)),
      end: new Date(Date.UTC(year, month, 1)),
    };
  }

  // Clamp to actual last day of each month to handle e.g. day 31 in February
  const lastDayOfMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startDay = Math.min(paydayStart, lastDayOfMonth);

  const lastDayOfNextMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const endDay = Math.min(paydayStart, lastDayOfNextMonth);

  return {
    start: new Date(Date.UTC(year, month - 1, startDay)),
    end: new Date(Date.UTC(year, month, endDay)),
  };
}
