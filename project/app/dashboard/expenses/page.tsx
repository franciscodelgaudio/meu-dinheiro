import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import { ExpensesManager } from "./expenses-manager";

type ExpensesPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
  }>;
};

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

function getMonthRange(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-").map(Number);

  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;
  const selectedMonth = normalizeReferenceMonth(params?.month);
  const monthRange = getMonthRange(selectedMonth);
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
    select: { currency: true, paydayStart: true, paydayEnd: true, monthlyIncome: true },
  });
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
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Gastos</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Gastos</h1>
        <p className="mt-2 text-muted-foreground">
          Registre cada gasto com data, descricao, grupo de despesa e valor.
        </p>
      </header>

      <ExpensesManager
        groups={groups}
        groupTotals={groupTotals}
        expenses={expenseItems}
        selectedMonth={selectedMonth}
        currency={financeProfile?.currency ?? "BRL"}
        paydayStart={financeProfile?.paydayStart ?? null}
        paydayEnd={financeProfile?.paydayEnd ?? null}
        totalIncome={totalIncome}
      />
    </main>
  );
}
