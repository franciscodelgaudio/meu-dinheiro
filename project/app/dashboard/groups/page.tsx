import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import { ExpenseGroupsManager, type YearMonthSummary } from "./expense-groups-manager";

type ExpensesPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
    view?: string | string[];
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
    select: { monthlyIncome: true, currency: true },
  });

  const base = Number(financeProfile?.monthlyIncome ?? 0);

  let yearData: YearMonthSummary[] | null = null;

  if (view === "year") {
    const selectedYear = selectedMonth.split("-")[0];
    const firstMonth = `${selectedYear}-01`;
    const lastMonth = `${selectedYear}-12`;

    const [yearGroups, yearExtraIncomes, yearSavings] = await Promise.all([
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
          referenceMonth: { gte: firstMonth, lte: lastMonth },
        },
      }),
    ]);

    yearData = Array.from({ length: 12 }, (_, i) => {
      const month = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;

      const activeGroups = yearGroups.filter(
        (g) =>
          g.referenceMonth === month ||
          (g.affectsFutureMonths && g.referenceMonth < month),
      );

      const totalExpenses = activeGroups.reduce((sum, g) => {
        const override = g.overrides.find((o) => o.referenceMonth === month);
        return sum + Number(override?.monthlyAmount ?? g.monthlyAmount);
      }, 0);

      const totalExtraIncome = yearExtraIncomes
        .filter((e) => e.referenceMonth === month)
        .reduce((sum, e) => sum + Number(e.amount), 0);

      const savings = Number(
        yearSavings.find((s) => s.referenceMonth === month)?.amount ?? 0,
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
    });
  }

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
  const extraIncomes = await prisma.extraIncome.findMany({
    where: { userId: user.id, referenceMonth: selectedMonth },
    orderBy: { createdAt: "desc" },
  });
  const savingsAllocation = await prisma.savingsAllocation.findUnique({
    where: {
      userId_referenceMonth: {
        userId: user.id,
        referenceMonth: selectedMonth,
      },
    },
  });
  const groups = expenseGroups.map((group) => {
    const override = group.overrides[0];

    return {
      id: group.id,
      referenceMonth: group.referenceMonth,
      name: override?.name ?? group.name,
      monthlyAmount: (override?.monthlyAmount ?? group.monthlyAmount).toString(),
      affectsFutureMonths: group.affectsFutureMonths,
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
    description: income.description,
    updatedAt: income.updatedAt.toISOString(),
  }));
  const savings = savingsAllocation
    ? {
        id: savingsAllocation.id,
        referenceMonth: savingsAllocation.referenceMonth,
        amount: savingsAllocation.amount.toString(),
        description: savingsAllocation.description,
        updatedAt: savingsAllocation.updatedAt.toISOString(),
      }
    : null;

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Gastos</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Grupos de despesas
        </h1>
        <p className="mt-2 text-muted-foreground">
          Planeje grupos do mes e decida quais continuam afetando os proximos
          meses.
        </p>
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
