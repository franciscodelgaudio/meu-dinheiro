import { auth } from "@/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

type DashboardPageProps = {
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

function formatReferenceMonth(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-").map(Number);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function getPercentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return (value / total) * 100;
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
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
  });
  const expenseGroups = await prisma.expenseGroup.findMany({
    where: {
      userId: user.id,
      OR: [
        { referenceMonth: selectedMonth },
        { affectsFutureMonths: true, referenceMonth: { lt: selectedMonth } },
      ],
    },
  });
  const extraIncomes = await prisma.extraIncome.findMany({
    where: { userId: user.id, referenceMonth: selectedMonth },
  });

  const currency = financeProfile?.currency ?? "BRL";
  const baseIncome = Number(financeProfile?.monthlyIncome ?? 0);
  const extraIncome = extraIncomes.reduce(
    (total, income) => total + Number(income.amount),
    0,
  );
  const totalIncome = baseIncome + extraIncome;
  const totalExpenses = expenseGroups.reduce(
    (total, group) => total + Number(group.monthlyAmount),
    0,
  );
  const remaining = totalIncome - totalExpenses;
  const committedPercentage = getPercentage(totalExpenses, totalIncome);
  const moneyFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  });

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground capitalize">
          {formatReferenceMonth(selectedMonth)}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Resumo financeiro
        </h1>
        <p className="mt-2 text-muted-foreground">
          Visao consolidada da renda, gastos planejados e sobra do mes.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Disponivel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">
              {moneyFormatter.format(totalIncome)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Base + renda extra do mes.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Gastos planejados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-red-700">
              {moneyFormatter.format(totalExpenses)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {expenseGroups.length} grupo(s) considerados.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Sobra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p
              className={
                remaining >= 0
                  ? "text-2xl font-semibold text-emerald-700"
                  : "text-2xl font-semibold text-red-700"
              }
            >
              {moneyFormatter.format(remaining)}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Depois dos gastos planejados.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Comprometimento da renda</CardTitle>
          <CardDescription>
            Quanto dos ganhos do mes ja esta tomado por grupos de despesas.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <Progress value={Math.min(committedPercentage, 100)} />
          <p className="text-sm text-muted-foreground">
            {new Intl.NumberFormat("pt-BR", {
              maximumFractionDigits: 1,
            }).format(committedPercentage)}
            % comprometido.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
