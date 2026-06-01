import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import { ExpensesManager } from "./expenses-manager";
import { getPaydayMonthRange, getCalendarMonth, getEffectiveCurrentMonth } from "@/lib/date-utils";

type ExpensesPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
  }>;
};

function normalizeReferenceMonth(
  value: string | string[] | undefined,
  paydayStart: number | null,
  incomeConfirmed: boolean,
) {
  const month = Array.isArray(value) ? value[0] : value;
  if (month && /^\d{4}-\d{2}$/.test(month)) return month;
  return getEffectiveCurrentMonth(paydayStart, incomeConfirmed);
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;
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

  const [financeProfile, incomeReceipt] = await Promise.all([
    prisma.userFinanceProfile.findUnique({
      where: { userId: user.id },
      select: { currency: true, paydayStart: true, paydayEnd: true, monthlyIncome: true },
    }),
    prisma.incomeReceipt.findUnique({
      where: { userId_referenceMonth: { userId: user.id, referenceMonth: getCalendarMonth() } },
    }),
  ]);

  const selectedMonth = normalizeReferenceMonth(
    params?.month,
    financeProfile?.paydayStart ?? null,
    incomeReceipt !== null,
  );
  const monthRange = getPaydayMonthRange(selectedMonth, financeProfile?.paydayStart ?? null);
  const extraIncomes = await prisma.extraIncome.findMany({
    where: { userId: user.id, referenceMonth: selectedMonth },
    select: { amount: true },
  });
  const totalIncome =
    Number(financeProfile?.monthlyIncome ?? 0) +
    extraIncomes.reduce((sum, e) => sum + Number(e.amount), 0);
  const expenseGroups = await prisma.expenseGroup.findMany({
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
  });
  const expenses = await prisma.expense.findMany({
    where: {
      userId: user.id,
      spentAt: {
        gte: monthRange.start,
        lt: monthRange.end,
      },
    },
    include: {
      expenseGroup: {
        include: {
          overrides: {
            where: { userId: user.id, referenceMonth: selectedMonth },
            take: 1,
          },
        },
      },
    },
    orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
  });
  const groups = expenseGroups.map((group) => {
    const override = group.overrides[0];

    return {
      id: group.id,
      referenceMonth: group.referenceMonth,
      name: override?.name ?? group.name,
      monthlyAmount: (override?.monthlyAmount ?? group.monthlyAmount).toString(),
      color: override?.color ?? group.color,
    };
  });
  const activeGroupIds = new Set(groups.map((group) => group.id));
  const commonExpenseSource = await prisma.expense.findMany({
    where: {
      userId: user.id,
      expenseGroupId: { in: Array.from(activeGroupIds) },
      creditCardPurchaseId: null,
    },
    select: {
      title: true,
      amount: true,
      behaviorType: true,
      coverageDays: true,
      expenseGroupId: true,
      spentAt: true,
      createdAt: true,
    },
    orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
    take: 200,
  });
  const commonExpenseMap = new Map<
    string,
    {
      title: string;
      amount: string;
      behaviorType: string;
      coverageDays: number;
      expenseGroupId: string;
      count: number;
      latestAt: number;
    }
  >();

  for (const expense of commonExpenseSource) {
    if (!activeGroupIds.has(expense.expenseGroupId)) {
      continue;
    }

    const normalizedTitle = expense.title.trim().toLowerCase();
    const key = `${normalizedTitle}:${expense.expenseGroupId}`;
    const latestAt = Math.max(expense.spentAt.getTime(), expense.createdAt.getTime());
    const existing = commonExpenseMap.get(key);

    if (!existing) {
      commonExpenseMap.set(key, {
        title: expense.title,
        amount: expense.amount.toString(),
        behaviorType: expense.behaviorType,
        coverageDays: expense.coverageDays,
        expenseGroupId: expense.expenseGroupId,
        count: 1,
        latestAt,
      });
      continue;
    }

    existing.count += 1;

    if (latestAt > existing.latestAt) {
      existing.title = expense.title;
      existing.amount = expense.amount.toString();
      existing.behaviorType = expense.behaviorType;
      existing.coverageDays = expense.coverageDays;
      existing.latestAt = latestAt;
    }
  }

  const commonExpenses = Array.from(commonExpenseMap.values())
    .sort((a, b) => b.count - a.count || b.latestAt - a.latestAt)
    .slice(0, 3)
    .map((expense) => ({
      title: expense.title,
      amount: expense.amount,
      behaviorType: expense.behaviorType,
      coverageDays: expense.coverageDays,
      expenseGroupId: expense.expenseGroupId,
      count: expense.count,
    }));
  const expenseItems = expenses.map((expense) => {
    const groupOverride = expense.expenseGroup.overrides[0];

    return {
      id: expense.id,
      spentAt: expense.spentAt.toISOString(),
      title: expense.title,
      amount: expense.amount.toString(),
      behaviorType: expense.behaviorType,
      coverageDays: expense.coverageDays,
      expenseGroupId: expense.expenseGroupId,
      groupName: groupOverride?.name ?? expense.expenseGroup.name,
      groupColor: groupOverride?.color ?? expense.expenseGroup.color,
      creditCardPurchaseId: expense.creditCardPurchaseId,
      installmentNumber: expense.installmentNumber,
      installmentCount: expense.installmentCount,
    };
  });
  const groupTotals = groups.map((group) => ({
    ...group,
    spentAmount: expenseItems
      .filter((expense) => expense.expenseGroupId === group.id)
      .reduce((total, expense) => total + Number(expense.amount), 0)
      .toFixed(2),
  }));

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Gastos</p>
        <h1 className="mt-1 text-xl font-bold text-zinc-950 sm:text-2xl">Lançamentos</h1>
      </header>

      <ExpensesManager
        groups={groups}
        groupTotals={groupTotals}
        expenses={expenseItems}
        commonExpenses={commonExpenses}
        selectedMonth={selectedMonth}
        currency={financeProfile?.currency ?? "BRL"}
        paydayStart={financeProfile?.paydayStart ?? null}
        paydayEnd={financeProfile?.paydayEnd ?? null}
        totalIncome={totalIncome}
      />
    </main>
  );
}
