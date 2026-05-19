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
