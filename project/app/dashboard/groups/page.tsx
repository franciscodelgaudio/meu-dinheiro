import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";
import { UserFinanceProfile } from "@/lib/models/user-finance-profile";
import { IncomeReceipt } from "@/lib/models/income-receipt";
import { ExpenseGroup } from "@/lib/models/expense-group";
import { ExpenseGroupOverride } from "@/lib/models/expense-group-override";
import { PlannedIncome } from "@/lib/models/planned-income";
import { SavingsAllocation } from "@/lib/models/savings-allocation";
import { redirect } from "next/navigation";

import { ExpenseGroupsManager, type YearMonthSummary } from "./expense-groups-manager";
import { getPaydayMonthRange, getCalendarMonth, getEffectiveCurrentMonth } from "@/lib/date-utils";

type ExpensesPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
    view?: string | string[];
  }>;
};

type FinanceProfileLean = {
  currency: string;
  paydayStart: number | null;
};

type ExpenseGroupLean = {
  _id: { toString(): string };
  referenceMonth: string;
  name: string;
  monthlyAmount: number;
  affectsFutureMonths: boolean;
  repeatMonths: string | null;
  color: string;
  description: string | null;
  priority: string;
  updatedAt: Date;
};

type ExpenseGroupOverrideLean = {
  expenseGroupId: string;
  referenceMonth: string;
  name: string;
  monthlyAmount: number;
  color: string;
  description: string | null;
  updatedAt: Date;
};

type PlannedIncomeLean = {
  _id: { toString(): string };
  referenceMonth: string;
  amount: number;
  affectsFutureMonths: boolean;
  repeatMonths: string | null;
  description: string | null;
  updatedAt: Date;
};

type SavingsAllocationLean = {
  _id: { toString(): string };
  referenceMonth: string;
  amount: number;
  affectsFutureMonths: boolean;
  repeatMonths: string | null;
  description: string | null;
  updatedAt: Date;
};

function isActiveInMonth(repeatMonths: string | null, targetMonth: string) {
  if (!repeatMonths) return true;
  const monthNum = Number(targetMonth.split("-")[1]);
  return repeatMonths.split(",").map(Number).includes(monthNum);
}

function isGroupActiveInMonth(repeatMonths: string | null, targetMonth: string) {
  return isActiveInMonth(repeatMonths, targetMonth);
}

function findActiveEntry<
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

function findAllActiveEntries<
  T extends { referenceMonth: string; affectsFutureMonths: boolean; repeatMonths: string | null },
>(entries: T[], targetMonth: string): T[] {
  return entries.filter(
    (e) =>
      e.referenceMonth === targetMonth ||
      (e.affectsFutureMonths &&
        e.referenceMonth < targetMonth &&
        isActiveInMonth(e.repeatMonths, targetMonth)),
  );
}

function normalizeReferenceMonth(
  value: string | string[] | undefined,
  paydayStart: number | null,
  incomeConfirmed: boolean,
) {
  const month = Array.isArray(value) ? value[0] : value;
  if (month && /^\d{4}-\d{2}$/.test(month)) return month;
  return getEffectiveCurrentMonth(paydayStart, incomeConfirmed);
}

function normalizeView(value: string | string[] | undefined): "month" | "year" {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "year" ? "year" : "month";
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;
  const view = normalizeView(params?.view);
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  await dbConnect();
  const user = await User.findOne({ email: session.user.email })
    .select("_id")
    .lean<{ _id: { toString(): string } }>();

  if (!user) {
    redirect("/login");
  }
  const userId = user._id.toString();

  const [financeProfile, incomeReceipt] = await Promise.all([
    UserFinanceProfile.findOne({ userId })
      .select("currency paydayStart")
      .lean<FinanceProfileLean>(),
    IncomeReceipt.findOne({
      userId,
      referenceMonth: getCalendarMonth(),
    }).lean(),
  ]);

  const selectedMonth = normalizeReferenceMonth(
    params?.month,
    financeProfile?.paydayStart ?? null,
    incomeReceipt !== null,
  );

  let yearData: YearMonthSummary[] | null = null;

  if (view === "year") {
    const selectedYear = selectedMonth.split("-")[0];
    const firstMonth = `${selectedYear}-01`;
    const lastMonth = `${selectedYear}-12`;
    const [yearGroups, yearPlannedIncomes, yearSavings] = await Promise.all([
      ExpenseGroup.find({
        userId,
        $or: [
          { referenceMonth: { $gte: firstMonth, $lte: lastMonth } },
          { affectsFutureMonths: true, referenceMonth: { $lt: firstMonth } },
        ],
      }).lean<ExpenseGroupLean[]>(),
      PlannedIncome.find({
        userId,
        $or: [
          { referenceMonth: { $gte: firstMonth, $lte: lastMonth } },
          { affectsFutureMonths: true, referenceMonth: { $lt: firstMonth } },
        ],
      })
        .sort({ referenceMonth: -1 })
        .lean<PlannedIncomeLean[]>(),
      SavingsAllocation.find({
        userId,
        $or: [
          { referenceMonth: { $gte: firstMonth, $lte: lastMonth } },
          { affectsFutureMonths: true, referenceMonth: { $lt: firstMonth } },
        ],
      })
        .sort({ referenceMonth: -1 })
        .lean<SavingsAllocationLean[]>(),
    ]);
    const yearGroupIds = yearGroups.map((group) => group._id.toString());
    const yearOverrides = await ExpenseGroupOverride.find({
      userId,
      referenceMonth: { $gte: firstMonth, $lte: lastMonth },
      expenseGroupId: { $in: yearGroupIds },
    }).lean<ExpenseGroupOverrideLean[]>();
    const yearOverridesByGroupId = new Map<string, ExpenseGroupOverrideLean[]>();
    for (const override of yearOverrides) {
      const list = yearOverridesByGroupId.get(override.expenseGroupId) ?? [];
      list.push(override);
      yearOverridesByGroupId.set(override.expenseGroupId, list);
    }

    yearData = Array.from({ length: 12 }, (_, i) => {
      const month = `${selectedYear}-${String(i + 1).padStart(2, "0")}`;

      const activeGroups = yearGroups.filter(
        (g) =>
          g.referenceMonth === month ||
          (g.affectsFutureMonths &&
            g.referenceMonth < month &&
            isGroupActiveInMonth(g.repeatMonths, month)),
      );

      const totalExpenses = activeGroups.reduce((sum, g) => {
        const override = yearOverridesByGroupId
          .get(g._id.toString())
          ?.find((o) => o.referenceMonth === month);
        return sum + Number(override?.monthlyAmount ?? g.monthlyAmount);
      }, 0);

      if (totalExpenses === 0) return null;

      const activePlannedIncomes = findAllActiveEntries(yearPlannedIncomes, month);
      const totalIncome = activePlannedIncomes.reduce((sum, e) => sum + Number(e.amount), 0);

      const savings = Number(
        findActiveEntry(yearSavings, month)?.amount ?? 0,
      );

      const totalCommitments = totalExpenses + savings;
      const remaining = totalIncome - totalCommitments;

      return {
        month,
        totalExpenses,
        savings,
        totalIncome,
        totalCommitments,
        remaining,
      };
    }).filter((row): row is YearMonthSummary => row !== null);
  }

  const selectedMonthRange = getPaydayMonthRange(selectedMonth, financeProfile?.paydayStart ?? null);
  const isSelectedMonthClosed = selectedMonthRange.end <= new Date();

  const [expenseGroups, plannedIncomeEntries, savingsEntries] = await Promise.all([
    ExpenseGroup.find({
      userId,
      $or: [
        { referenceMonth: selectedMonth },
        { affectsFutureMonths: true, referenceMonth: { $lt: selectedMonth } },
      ],
    })
      .sort({ referenceMonth: -1, createdAt: -1 })
      .lean<ExpenseGroupLean[]>(),
    PlannedIncome.find({
      userId,
      $or: [
        { referenceMonth: selectedMonth },
        { affectsFutureMonths: true, referenceMonth: { $lt: selectedMonth } },
      ],
    })
      .sort({ referenceMonth: -1 })
      .lean<PlannedIncomeLean[]>(),
    SavingsAllocation.find({
      userId,
      $or: [
        { referenceMonth: selectedMonth },
        { affectsFutureMonths: true, referenceMonth: { $lt: selectedMonth } },
      ],
    })
      .sort({ referenceMonth: -1 })
      .lean<SavingsAllocationLean[]>(),
  ]);
  const expenseGroupIds = expenseGroups.map((group) => group._id.toString());
  const expenseGroupOverrides = await ExpenseGroupOverride.find({
    userId,
    referenceMonth: selectedMonth,
    expenseGroupId: { $in: expenseGroupIds },
  }).lean<ExpenseGroupOverrideLean[]>();
  const overrideByGroupId = new Map(
    expenseGroupOverrides.map((override) => [override.expenseGroupId, override]),
  );

  const plannedIncomesForMonth = findAllActiveEntries(plannedIncomeEntries, selectedMonth);
  const savingsAllocation = findActiveEntry(savingsEntries, selectedMonth);

  const activeExpenseGroups = expenseGroups.filter(
    (g) =>
      g.referenceMonth === selectedMonth ||
      isGroupActiveInMonth(g.repeatMonths, selectedMonth),
  );

  const groups = activeExpenseGroups.map((group) => {
    const groupId = group._id.toString();
    const override = overrideByGroupId.get(groupId);

    const monthlyAmount = (override?.monthlyAmount ?? group.monthlyAmount).toString();

    return {
      id: groupId,
      referenceMonth: group.referenceMonth,
      name: override?.name ?? group.name,
      monthlyAmount,
      affectsFutureMonths: group.affectsFutureMonths,
      repeatMonths: group.repeatMonths,
      color: override?.color ?? group.color,
      description: override ? override.description : group.description,
      updatedAt: (override?.updatedAt ?? group.updatedAt).toISOString(),
    };
  });

  const plannedIncomes = plannedIncomesForMonth.map((e) => ({
    id: e._id.toString(),
    referenceMonth: e.referenceMonth,
    amount: e.amount.toString(),
    affectsFutureMonths: e.affectsFutureMonths,
    repeatMonths: e.repeatMonths,
    description: e.description,
    updatedAt: e.updatedAt.toISOString(),
  }));

  const savings = savingsAllocation
    ? {
        id: savingsAllocation._id.toString(),
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
        plannedIncomes={plannedIncomes}
        savingsAllocation={savings}
        selectedMonth={selectedMonth}
        currency={financeProfile?.currency ?? "BRL"}
        mode="expenses"
        view={view}
        yearData={yearData ?? undefined}
        isSelectedMonthClosed={isSelectedMonthClosed}
      />
    </main>
  );
}
