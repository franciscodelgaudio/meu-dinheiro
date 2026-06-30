import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";
import { UserFinanceProfile } from "@/lib/models/user-finance-profile";
import { ExpenseGroup } from "@/lib/models/expense-group";
import { ExpenseGroupOverride } from "@/lib/models/expense-group-override";
import { Expense } from "@/lib/models/expense";
import { PlannedIncome } from "@/lib/models/planned-income";
import { SavingsAllocation } from "@/lib/models/savings-allocation";
import { CreditCardPurchase } from "@/lib/models/credit-card-purchase";
import { IncomeReceipt } from "@/lib/models/income-receipt";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Wallet,
  TrendingUp,
  HandCoins,
  ArrowRight,
  Plus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getPaydayMonthRange, getCalendarMonth, getEffectiveCurrentMonth } from "@/lib/date-utils";
import { IncomeReceiptBanner } from "./income-receipt-banner";

type DashboardPageProps = {
  searchParams?: Promise<{ month?: string | string[] }>;
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


type FinanceProfileLean = {
  currency: string;
  paydayStart: number | null;
};

type ExpenseGroupLean = {
  _id: { toString(): string };
  referenceMonth: string;
  monthlyAmount: number;
};

type ExpenseGroupOverrideLean = {
  expenseGroupId: string;
  monthlyAmount: number;
};

type PlannedIncomeLean = {
  amount: number;
  affectsFutureMonths: boolean;
  repeatMonths: string | null;
};

type SavingsAllocationLean = {
  amount: number;
};

type CreditCardPurchaseLean = {
  firstInstallmentMonth: string;
  totalAmount: number;
  installmentCount: number;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user?.email) redirect("/login");

  await dbConnect();
  const user = await User.findOne({ email: session.user.email })
    .select("_id")
    .lean<{ _id: { toString(): string } }>();

  if (!user) redirect("/login");
  const userId = user._id.toString();

  const [financeProfile, incomeReceiptForCalendarMonth] = await Promise.all([
    UserFinanceProfile.findOne({ userId })
      .select("currency paydayStart")
      .lean<FinanceProfileLean>(),
    IncomeReceipt.findOne({
      userId,
      referenceMonth: getCalendarMonth(),
    }).lean(),
  ]);

  const incomeConfirmed = incomeReceiptForCalendarMonth !== null;
  const calendarMonth = getCalendarMonth();
  const selectedMonth = normalizeReferenceMonth(
    params?.month,
    financeProfile?.paydayStart ?? null,
    incomeConfirmed,
  );

  // Show banner when payday has arrived but income hasn't been confirmed yet
  const today = new Date();
  const paydayStart = financeProfile?.paydayStart ?? null;
  const showReceiptBanner =
    paydayStart !== null &&
    today.getDate() >= paydayStart &&
    !incomeConfirmed;
  const expenseGroups = await ExpenseGroup.find({
    userId,
    $or: [
      { referenceMonth: selectedMonth },
      { affectsFutureMonths: true, referenceMonth: { $lt: selectedMonth } },
    ],
  })
    .select("_id referenceMonth monthlyAmount")
    .lean<ExpenseGroupLean[]>();

  const expenseGroupIds = expenseGroups.map((group) => group._id.toString());

  const [expenseGroupOverrides, plannedIncomeEntries, savingsAllocation, debtCommitments] =
    await Promise.all([
      ExpenseGroupOverride.find({
        userId,
        referenceMonth: selectedMonth,
        expenseGroupId: { $in: expenseGroupIds },
      })
        .select("expenseGroupId monthlyAmount")
        .lean<ExpenseGroupOverrideLean[]>(),
      PlannedIncome.find({
        userId,
        $or: [
          { referenceMonth: selectedMonth },
          { affectsFutureMonths: true, referenceMonth: { $lt: selectedMonth } },
        ],
      })
        .select("amount affectsFutureMonths repeatMonths referenceMonth")
        .sort({ referenceMonth: -1 })
        .lean<(PlannedIncomeLean & { referenceMonth: string })[]>(),
      SavingsAllocation.findOne({ userId, referenceMonth: selectedMonth })
        .select("amount")
        .lean<SavingsAllocationLean>(),
      CreditCardPurchase.find({
        userId,
        kind: "debt",
        firstInstallmentMonth: { $lte: selectedMonth },
      })
        .select("firstInstallmentMonth totalAmount installmentCount")
        .lean<CreditCardPurchaseLean[]>(),
    ]);

  const overrideByGroupId = new Map(
    expenseGroupOverrides.map((override) => [override.expenseGroupId, override]),
  );

  const { start: monthStart, end: monthEnd } = getPaydayMonthRange(
    selectedMonth,
    financeProfile?.paydayStart ?? null,
  );
  const [actualExpensesAgg] = await Expense.aggregate<{
    totalAmount: number;
    count: number;
  }>([
    { $match: { userId, spentAt: { $gte: monthStart, $lt: monthEnd } } },
    { $group: { _id: null, totalAmount: { $sum: "$amount" }, count: { $sum: 1 } } },
  ]);

  const currency = financeProfile?.currency ?? "BRL";
  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency });

  const totalIncome = plannedIncomeEntries
    .filter((e) => {
      if (e.referenceMonth === selectedMonth) return true;
      if (!e.affectsFutureMonths) return false;
      if (e.referenceMonth >= selectedMonth) return false;
      if (!e.repeatMonths) return true;
      const monthNum = Number(selectedMonth.split("-")[1]);
      return e.repeatMonths.split(",").map(Number).includes(monthNum);
    })
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const totalExpenses = expenseGroups.reduce(
    (t, g) => t + Number(overrideByGroupId.get(g._id.toString())?.monthlyAmount ?? g.monthlyAmount),
    0,
  );
  const totalSavings = Number(savingsAllocation?.amount ?? 0);
  const totalDebts = debtCommitments.reduce((total, debt) => {
    const idx = getMonthDistance(debt.firstInstallmentMonth, selectedMonth);
    if (idx < 0 || idx >= debt.installmentCount) return total;
    const amounts = getInstallmentAmounts(Number(debt.totalAmount), debt.installmentCount);
    return total + (amounts[idx] ?? 0);
  }, 0);
  const totalActualSpent = Number(actualExpensesAgg?.totalAmount ?? 0);
  const actualExpenseCount = actualExpensesAgg?.count ?? 0;
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

      {/* Income receipt banner */}
      {showReceiptBanner && (
        <IncomeReceiptBanner
          calendarMonth={calendarMonth}
          formattedMonth={formatReferenceMonth(calendarMonth)}
        />
      )}

      {/* 3 metric cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
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
            <p className="mt-1 hidden text-xs text-zinc-400 sm:block">Renda planejada do mês</p>
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

        {/* Dívidas do mês */}
        <Card className="col-span-2 border-zinc-200 shadow-sm sm:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-xs font-medium text-zinc-500">Dívidas do mês</CardTitle>
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500">
                <HandCoins size={15} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-bold text-zinc-950 sm:text-2xl">{fmt.format(totalDebts)}</p>
            <p className="mt-1 hidden text-xs text-zinc-400 sm:block">Parcelas do mês</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick links */}
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
          Acesso rápido
        </p>
        <Link
          href="/dashboard/expenses"
          className="group flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm transition hover:border-zinc-300 hover:shadow-md"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600">
            <Plus size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-zinc-800">Lançamentos</p>
            <p className="text-xs text-zinc-400">Registre seus gastos</p>
          </div>
          <ArrowRight
            size={16}
            className="shrink-0 text-zinc-300 transition group-hover:text-zinc-500"
          />
        </Link>
      </div>

    </main>
  );
}
