import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  ReceiptText,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  HandCoins,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { FinancialInsights, FinancialInsightsSkeleton } from "./financial-insights";
import { getPaydayMonthRange } from "@/lib/date-utils";

type DashboardPageProps = {
  searchParams?: Promise<{ month?: string | string[] }>;
};

function getCurrentReferenceMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function normalizeReferenceMonth(value: string | string[] | undefined) {
  const month = Array.isArray(value) ? value[0] : value;
  if (month && /^\d{4}-\d{2}$/.test(month)) return month;
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

function getPrevMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getNextMonth(month: string) {
  const [year, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(year, m, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getMonthDistance(startMonth: string, endMonth: string) {
  const [sy, sm] = startMonth.split("-").map(Number);
  const [ey, em] = endMonth.split("-").map(Number);
  return (ey - sy) * 12 + (em - sm);
}

function getInstallmentAmounts(totalAmount: number, installmentCount: number) {
  const totalInCents = Math.round(totalAmount * 100);
  const baseInCents = Math.floor(totalInCents / installmentCount);
  const remainder = totalInCents % installmentCount;
  return Array.from({ length: installmentCount }, (_, i) => {
    return (baseInCents + (i < remainder ? 1 : 0)) / 100;
  });
}

const quickLinks = [
  {
    href: "/dashboard/groups",
    icon: CreditCard,
    label: "Grupos de despesa",
    description: "Organize por categorias",
    color: "bg-orange-50 text-orange-600",
  },
  {
    href: "/dashboard/expenses",
    icon: ReceiptText,
    label: "Lançamentos",
    description: "Registre seus gastos",
    color: "bg-zinc-100 text-zinc-600",
  },
  {
    href: "/dashboard/debts",
    icon: HandCoins,
    label: "Dívidas",
    description: "Parcelas e compromissos",
    color: "bg-violet-50 text-violet-600",
  },
];

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const selectedMonth = normalizeReferenceMonth(params?.month);
  const session = await auth();

  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) redirect("/login");

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
    include: {
      overrides: {
        where: { userId: user.id, referenceMonth: selectedMonth },
        take: 1,
      },
    },
  });
  const extraIncomes = await prisma.extraIncome.findMany({
    where: { userId: user.id, referenceMonth: selectedMonth },
  });
  const savingsAllocation = await prisma.savingsAllocation.findUnique({
    where: { userId_referenceMonth: { userId: user.id, referenceMonth: selectedMonth } },
  });
  const debtCommitments = await prisma.creditCardPurchase.findMany({
    where: { userId: user.id, kind: "debt", firstInstallmentMonth: { lte: selectedMonth } },
  });

  const { start: monthStart, end: monthEnd } = getPaydayMonthRange(
    selectedMonth,
    financeProfile?.paydayStart ?? null,
  );
  const actualExpensesAgg = await prisma.expense.aggregate({
    where: { userId: user.id, spentAt: { gte: monthStart, lt: monthEnd } },
    _sum: { amount: true },
    _count: true,
  });

  const currency = financeProfile?.currency ?? "BRL";
  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency });

  const baseIncome = Number(financeProfile?.monthlyIncome ?? 0);
  const extraIncome = extraIncomes.reduce((t, e) => t + Number(e.amount), 0);
  const totalIncome = baseIncome + extraIncome;
  const totalExpenses = expenseGroups.reduce(
    (t, g) => t + Number(g.overrides[0]?.monthlyAmount ?? g.monthlyAmount),
    0,
  );
  const totalSavings = Number(savingsAllocation?.amount ?? 0);
  const totalDebts = debtCommitments.reduce((total, debt) => {
    const idx = getMonthDistance(debt.firstInstallmentMonth, selectedMonth);
    if (idx < 0 || idx >= debt.installmentCount) return total;
    const amounts = getInstallmentAmounts(Number(debt.totalAmount), debt.installmentCount);
    return total + (amounts[idx] ?? 0);
  }, 0);
  const totalActualSpent = Number(actualExpensesAgg._sum.amount ?? 0);
  const actualExpenseCount = actualExpensesAgg._count;
  const remaining = totalIncome - totalExpenses - totalSavings;

  const spentPct = totalExpenses > 0 ? Math.min((totalActualSpent / totalExpenses) * 100, 100) : 0;

  const prevMonth = getPrevMonth(selectedMonth);
  const nextMonth = getNextMonth(selectedMonth);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      {/* Header + month navigator */}
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
            Resumo financeiro
          </p>
          <h1 className="mt-1 text-xl font-bold capitalize text-zinc-950 sm:text-2xl">
            {formatReferenceMonth(selectedMonth)}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm">
          <Link
            href={`/dashboard?month=${prevMonth}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <ChevronLeft size={15} />
          </Link>
          <span className="hidden px-1 text-xs font-medium capitalize text-zinc-600 sm:inline">
            {formatReferenceMonth(selectedMonth)}
          </span>
          <Link
            href={`/dashboard?month=${nextMonth}`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
          >
            <ChevronRight size={15} />
          </Link>
        </div>
      </header>

      {/* 4 metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {/* Renda total */}
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-zinc-500">Renda total</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Wallet size={15} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-zinc-950 sm:text-2xl">{fmt.format(totalIncome)}</p>
            {extraIncome > 0 ? (
              <p className="mt-1 hidden text-xs text-zinc-400 sm:block">
                Base {fmt.format(baseIncome)} + extra {fmt.format(extraIncome)}
              </p>
            ) : (
              <p className="mt-1 hidden text-xs text-zinc-400 sm:block">Renda base do mês</p>
            )}
          </CardContent>
        </Card>

        {/* Gastos planejados */}
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-zinc-500">Gastos planejados</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-500">
                <ReceiptText size={15} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-zinc-950 sm:text-2xl">{fmt.format(totalExpenses)}</p>
            <p className="mt-1 hidden text-xs text-zinc-400 sm:block">
              {expenseGroups.length} grupo{expenseGroups.length !== 1 ? "s" : ""} no mês
            </p>
          </CardContent>
        </Card>

        {/* Gasto real */}
        <Card className="border-zinc-200 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-zinc-500">Gasto real</CardTitle>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  spentPct >= 90 ? "bg-red-50 text-red-500" : "bg-zinc-100 text-zinc-500"
                }`}
              >
                <TrendingUp size={15} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-zinc-950 sm:text-2xl">{fmt.format(totalActualSpent)}</p>
            <div className="mt-2 space-y-1">
              <div className="flex justify-between text-xs text-zinc-400">
                <span className="hidden sm:inline">
                  {actualExpenseCount} lançamento{actualExpenseCount !== 1 ? "s" : ""}
                </span>
                <span>{spentPct.toFixed(0)}%</span>
              </div>
              <Progress value={spentPct} className="h-1.5" />
            </div>
          </CardContent>
        </Card>

        {/* Saldo planejado */}
        <Card
          className={`border-zinc-200 shadow-sm ${remaining < 0 ? "bg-red-50/40" : ""}`}
        >
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-zinc-500">Saldo planejado</CardTitle>
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                  remaining >= 0 ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
                }`}
              >
                {remaining >= 0 ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p
              className={`text-lg font-bold sm:text-2xl ${
                remaining >= 0 ? "text-emerald-700" : "text-red-600"
              }`}
            >
              {fmt.format(remaining)}
            </p>
            <p className="mt-1 hidden text-xs text-zinc-400 sm:block">
              {remaining >= 0 ? "Após gastos, poupança e dívidas" : "Orçamento excedido"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Savings + Debts strip */}
      {(totalSavings > 0 || totalDebts > 0) && (
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
          {totalSavings > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                <PiggyBank size={17} />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Poupança do mês</p>
                <p className="text-base font-bold text-zinc-950">{fmt.format(totalSavings)}</p>
              </div>
            </div>
          )}
          {totalDebts > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-500">
                <HandCoins size={17} />
              </div>
              <div>
                <p className="text-xs text-zinc-500">Parcelas do mês</p>
                <p className="text-base font-bold text-zinc-950">{fmt.format(totalDebts)}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick links */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Acesso rápido
        </p>
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {quickLinks.map(({ href, icon: Icon, label, description, color }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
                <Icon size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-zinc-800">{label}</p>
                <p className="text-xs text-zinc-400">{description}</p>
              </div>
              <ArrowRight
                size={14}
                className="shrink-0 text-zinc-300 transition group-hover:text-zinc-500"
              />
            </Link>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Análise da IA
        </p>
        <Suspense fallback={<FinancialInsightsSkeleton />}>
          <FinancialInsights selectedMonth={selectedMonth} />
        </Suspense>
      </div>
    </main>
  );
}
