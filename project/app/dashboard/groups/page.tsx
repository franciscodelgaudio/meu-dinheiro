import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import { ExpenseGroupsManager, type YearMonthSummary } from "./expense-groups-manager";
import { getPaydayMonthRange } from "@/lib/date-utils";

type ExpensesPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
    view?: string | string[];
  }>;
};

function isActiveInMonth(repeatMonths: string | null, targetMonth: string) {
  if (!repeatMonths) return true;
  const monthNum = Number(targetMonth.split("-")[1]);
  return repeatMonths.split(",").map(Number).includes(monthNum);
}

function isGroupActiveInMonth(
  repeatMonths: string | null,
  targetMonth: string,
) {
  return isActiveInMonth(repeatMonths, targetMonth);
}

function findActiveSavings<
  T extends { referenceMonth: string; affectsFutureMonths: boolean; repeatMonths: string | null },
>(entries: T[], targetMonth: string): T | null {
  const direct = entries.find((s) => s.referenceMonth === targetMonth);
  if (direct) return direct;
  return (
    entries.find(
      (s) =>
        s.affectsFutureMonths &&
        s.referenceMonth < targetMonth &&
        isActiveInMonth(s.repeatMonths, targetMonth),
    ) ?? null
  );
}

function getCurrentReferenceMonth() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeReferenceMonth(value: string | string[] | undefined) {
  const month = Array.isArray(value) ? value[0] : value;

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    return month;
  }

  return getCurrentReferenceMonth();
}

function normalizeView(value: string | string[] | undefined): "month" | "year" {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "year" ? "year" : "month";
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;
  const selectedMonth = normalizeReferenceMonth(params?.month);
  const view = normalizeView(params?.view);
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) {
    redirect("/login");
  }

  const financeProfile = await prisma.userFinanceProfile.findUnique({
    where: { userId: user.id },
    select: { monthlyIncome: true, currency: true, paydayStart: true },
  });

  const base = Number(financeProfile?.monthlyIncome ?? 0);

  let yearData: YearMonthSummary[] | null = null;

  if (view === "year") {
    const selectedYear = selectedMonth.split("-")[0];
    const firstMonth = `${selectedYear}-01`;
    const lastMonth = `${selectedYear}-12`;
    const paydayStart = financeProfile?.paydayStart ?? null;
    const now = new Date();

    const allYearMonths = Array.from({ length: 12 }, (_, i) =>
      `${selectedYear}-${String(i + 1).padStart(2, "0")}`
    );
    const pastMonthRanges = allYearMonths
      .map((m) => ({ month: m, range: getPaydayMonthRange(m, paydayStart) }))
      .filter(({ range }) => range.end <= now);

    const [yearGroups, yearExtraIncomes, yearSavings, yearActualExpenses] = await Promise.all([
      prisma.expenseGroup.findMany({
        where: {
          userId: user.id,
          OR: [
            { referenceMonth: { gte: firstMonth, lte: lastMonth } },
            { affectsFutureMonths: true, referenceMonth: { lt: firstMonth } },
          ],
        },
        include: {
          overrides: {
            where: {
              userId: user.id,
              referenceMonth: { gte: firstMonth, lte: lastMonth },
            },
          },
        },
      }),
      prisma.extraIncome.findMany({
        where: {
          userId: user.id,
          referenceMonth: { gte: firstMonth, lte: lastMonth },
        },
      }),
      prisma.savingsAllocation.findMany({
        where: {
          userId: user.id,
          OR: [
            { referenceMonth: { gte: firstMonth, lte: lastMonth } },
            { affectsFutureMonths: true, referenceMonth: { lt: firstMonth } },
          ],
        },
        orderBy: { referenceMonth: "desc" },
      }),
      pastMonthRanges.length > 0
        ? prisma.expense.findMany({
            where: {
              userId: user.id,
              spentAt: {
                gte: pastMonthRanges.reduce(
                  (min, { range }) => (range.start < min ? range.start : min),
                  pastMonthRanges[0].range.start,
                ),
                lt: pastMonthRanges.reduce(
                  (max, { range }) => (range.end > max ? range.end : max),
                  pastMonthRanges[0].range.end,
                ),
              },
            },
            select: { expenseGroupId: true, spentAt: true, amount: true },
          })
        : Promise.resolve([]),
    ]);

    yearData = Array.from({ length: 12 }, (_, i) => {
      const month = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;
      const monthRange = getPaydayMonthRange(month, paydayStart);
      const isMonthClosed = monthRange.end <= now;

      const activeGroups = yearGroups.filter(
        (g) =>
          g.referenceMonth === month ||
          (g.affectsFutureMonths &&
            g.referenceMonth < month &&
            isGroupActiveInMonth(g.repeatMonths, month)),
      );

      let totalExpenses: number;
      if (isMonthClosed) {
        totalExpenses = yearActualExpenses
          .filter((e) => e.spentAt >= monthRange.start && e.spentAt < monthRange.end)
          .reduce((sum, e) => sum + Number(e.amount), 0);
      } else {
        totalExpenses = activeGroups.reduce((sum, g) => {
          const override = g.overrides.find((o) => o.referenceMonth === month);
          return sum + Number(override?.monthlyAmount ?? g.monthlyAmount);
        }, 0);
      }

      if (totalExpenses === 0) return null;

      const totalExtraIncome = yearExtraIncomes
        .filter((e) => e.referenceMonth === month)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const savings = Number(
        findActiveSavings(yearSavings, month)?.amount ?? 0,
      );

      const totalIncome = base + totalExtraIncome;
      const totalCommitments = totalExpenses + savings;
      const remaining = totalIncome - totalCommitments;

      return {
        month,
        totalExpenses,
        totalExtraIncome,
        savings,
        totalIncome,
        totalCommitments,
        remaining,
      };
    }).filter((row): row is YearMonthSummary => row !== null);
  }

  const selectedMonthRange = getPaydayMonthRange(selectedMonth, financeProfile?.paydayStart ?? null);
  const isSelectedMonthClosed = selectedMonthRange.end <= new Date();

  const [expenseGroups, extraIncomes, savingsEntries, monthActualExpenses] = await Promise.all([
    prisma.expenseGroup.findMany({
      where: {
        userId: user.id,
        OR: [
          { referenceMonth: selectedMonth },
          { affectsFutureMonths: true, referenceMonth: { lt: selectedMonth } },
        ],
      },
      include: {
        overrides: {
          where: { userId: user.id, referenceMonth: selectedMonth },
          take: 1,
        },
      },
      orderBy: [{ referenceMonth: "desc" }, { createdAt: "desc" }],
    }),
    prisma.extraIncome.findMany({
      where: { userId: user.id, referenceMonth: selectedMonth },
      orderBy: { createdAt: "desc" },
    }),
    prisma.savingsAllocation.findMany({
      where: {
        userId: user.id,
        OR: [
          { referenceMonth: selectedMonth },
          { affectsFutureMonths: true, referenceMonth: { lt: selectedMonth } },
        ],
      },
      orderBy: { referenceMonth: "desc" },
    }),
    isSelectedMonthClosed
      ? prisma.expense.groupBy({
          by: ["expenseGroupId"],
          where: {
            userId: user.id,
            spentAt: { gte: selectedMonthRange.start, lt: selectedMonthRange.end },
          },
          _sum: { amount: true },
        })
      : Promise.resolve([]),
  ]);

  const actualByGroup = new Map(
    monthActualExpenses.map((e) => [e.expenseGroupId, Number(e._sum?.amount ?? 0)])
  );

  const savingsAllocation = findActiveSavings(savingsEntries, selectedMonth);
  const activeExpenseGroups = expenseGroups.filter(
    (g) =>
      g.referenceMonth === selectedMonth ||
      isGroupActiveInMonth(g.repeatMonths, selectedMonth),
  );

  const groups = activeExpenseGroups.map((group) => {
    const override = group.overrides[0];

    const monthlyAmount = isSelectedMonthClosed
      ? (actualByGroup.get(group.id) ?? 0).toString()
      : (override?.monthlyAmount ?? group.monthlyAmount).toString();

    return {
      id: group.id,
      referenceMonth: group.referenceMonth,
      name: override?.name ?? group.name,
      monthlyAmount,
      affectsFutureMonths: group.affectsFutureMonths,
      repeatMonths: group.repeatMonths,
      color: override?.color ?? group.color,
      description: override ? override.description : group.description,
      priority: group.priority,
      updatedAt: (override?.updatedAt ?? group.updatedAt).toISOString(),
    };
  });
  const extras = extraIncomes.map((income) => ({
    id: income.id,
    referenceMonth: income.referenceMonth,
    name: income.name,
    amount: income.amount.toString(),
    receivedDay: income.receivedDay,
    description: income.description,
    updatedAt: income.updatedAt.toISOString(),
  }));
  const savings = savingsAllocation
    ? {
        id: savingsAllocation.id,
        referenceMonth: savingsAllocation.referenceMonth,
        amount: savingsAllocation.amount.toString(),
        affectsFutureMonths: savingsAllocation.affectsFutureMonths,
        repeatMonths: savingsAllocation.repeatMonths,
        description: savingsAllocation.description,
        updatedAt: savingsAllocation.updatedAt.toISOString(),
      }
    : null;

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Planejamento
        </p>
        <h1 className="mt-1 text-xl font-bold text-zinc-950 sm:text-2xl">
          Grupos de despesas
        </h1>
      </header>

      <ExpenseGroupsManager
        groups={groups}
        extraIncomes={extras}
        savingsAllocation={savings}
        selectedMonth={selectedMonth}
        baseIncome={financeProfile?.monthlyIncome.toString() ?? "0.00"}
        currency={financeProfile?.currency ?? "BRL"}
        mode="expenses"
        view={view}
        yearData={yearData ?? undefined}
      />
    </main>
  );
}
