import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import { ExpenseGroupsManager } from "./expense-groups-manager";

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

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;
  const selectedMonth = normalizeReferenceMonth(params?.month);
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
  const expenseGroups = await prisma.expenseGroup.findMany({
    where: {
      userId: user.id,
      OR: [
        { referenceMonth: selectedMonth },
        { affectsFutureMonths: true, referenceMonth: { lt: selectedMonth } },
      ],
    },
    orderBy: [{ referenceMonth: "desc" }, { createdAt: "desc" }],
  });
  const extraIncomes = await prisma.extraIncome.findMany({
    where: { userId: user.id, referenceMonth: selectedMonth },
    orderBy: { createdAt: "desc" },
  });
  const groups = expenseGroups.map((group) => ({
    id: group.id,
    referenceMonth: group.referenceMonth,
    name: group.name,
    monthlyAmount: group.monthlyAmount.toString(),
    affectsFutureMonths: group.affectsFutureMonths,
    color: group.color,
    description: group.description,
    updatedAt: group.updatedAt.toISOString(),
  }));
  const extras = extraIncomes.map((income) => ({
    id: income.id,
    referenceMonth: income.referenceMonth,
    name: income.name,
    amount: income.amount.toString(),
    description: income.description,
    updatedAt: income.updatedAt.toISOString(),
  }));

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
        selectedMonth={selectedMonth}
        baseIncome={financeProfile?.monthlyIncome.toString() ?? "0.00"}
        currency={financeProfile?.currency ?? "BRL"}
        mode="expenses"
      />
    </main>
  );
}
