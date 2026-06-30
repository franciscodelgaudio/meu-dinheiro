import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";
import { UserFinanceProfile } from "@/lib/models/user-finance-profile";
import { IncomeReceipt } from "@/lib/models/income-receipt";
import { ExpenseGroup } from "@/lib/models/expense-group";
import { ExpenseGroupOverride } from "@/lib/models/expense-group-override";
import { Expense } from "@/lib/models/expense";
import { redirect } from "next/navigation";

import { ExpensesManager } from "./expenses-manager";
import { getPaydayMonthRange, getCalendarMonth, getEffectiveCurrentMonth } from "@/lib/date-utils";

const EXPENSES_PER_PAGE = 10;

type ExpensesPageProps = {
  searchParams?: Promise<{
    month?: string | string[];
    page?: string | string[];
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

type FinanceProfileLean = {
  currency: string;
  paydayStart: number | null;
};

type ExpenseGroupLean = {
  _id: { toString(): string };
  referenceMonth: string;
  name: string;
  monthlyAmount: number;
  color: string;
};

type ExpenseGroupOverrideLean = {
  expenseGroupId: string;
  name: string;
  monthlyAmount: number;
  color: string;
};

type ExpenseLean = {
  _id: { toString(): string };
  expenseGroupId: string;
  creditCardPurchaseId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  spentAt: Date;
  title: string;
  amount: number;
  behaviorType: string;
  coverageDays: number;
  createdAt: Date;
};

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const params = await searchParams;
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

  const rawPage = Array.isArray(params?.page) ? params.page[0] : params?.page;
  const currentPage = Math.max(1, parseInt(rawPage ?? "1", 10) || 1);
  const monthRange = getPaydayMonthRange(selectedMonth, financeProfile?.paydayStart ?? null);
  const expenseGroups = await ExpenseGroup.find({
    userId,
    $or: [
      { referenceMonth: selectedMonth },
      { affectsFutureMonths: true, referenceMonth: { $lt: selectedMonth } },
    ],
  })
    .sort({ referenceMonth: -1, createdAt: -1 })
    .lean<ExpenseGroupLean[]>();

  const expenseGroupIds = expenseGroups.map((group) => group._id.toString());
  const expenseMatchFilter = {
    userId,
    spentAt: { $gte: monthRange.start, $lt: monthRange.end },
  };

  const [expenseGroupOverrides, expenses, totalExpenses, groupSpentAggregation] = await Promise.all([
    ExpenseGroupOverride.find({
      userId,
      referenceMonth: selectedMonth,
      expenseGroupId: { $in: expenseGroupIds },
    }).lean<ExpenseGroupOverrideLean[]>(),
    Expense.find(expenseMatchFilter)
      .sort({ spentAt: -1, createdAt: -1 })
      .skip((currentPage - 1) * EXPENSES_PER_PAGE)
      .limit(EXPENSES_PER_PAGE)
      .lean<ExpenseLean[]>(),
    Expense.countDocuments(expenseMatchFilter),
    Expense.aggregate<{ _id: string; spentAmount: number }>([
      { $match: expenseMatchFilter },
      { $group: { _id: "$expenseGroupId", spentAmount: { $sum: "$amount" } } },
    ]),
  ]);

  const overrideByGroupId = new Map(
    expenseGroupOverrides.map((override) => [override.expenseGroupId, override]),
  );
  const groupById = new Map(expenseGroups.map((group) => [group._id.toString(), group]));

  const groups = expenseGroups.map((group) => {
    const groupId = group._id.toString();
    const override = overrideByGroupId.get(groupId);

    return {
      id: groupId,
      referenceMonth: group.referenceMonth,
      name: override?.name ?? group.name,
      monthlyAmount: (override?.monthlyAmount ?? group.monthlyAmount).toString(),
      color: override?.color ?? group.color,
    };
  });
  const activeGroupIds = new Set(groups.map((group) => group.id));
  const commonExpenseSource = await Expense.find({
    userId,
    expenseGroupId: { $in: Array.from(activeGroupIds) },
    creditCardPurchaseId: null,
  })
    .select("title amount behaviorType coverageDays expenseGroupId spentAt createdAt")
    .sort({ spentAt: -1, createdAt: -1 })
    .limit(200)
    .lean<ExpenseLean[]>();
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
    const expenseId = expense._id.toString();
    const group = groupById.get(expense.expenseGroupId);
    const groupOverride = overrideByGroupId.get(expense.expenseGroupId);

    return {
      id: expenseId,
      spentAt: expense.spentAt.toISOString(),
      title: expense.title,
      amount: expense.amount.toString(),
      behaviorType: expense.behaviorType,
      coverageDays: expense.coverageDays,
      expenseGroupId: expense.expenseGroupId,
      groupName: groupOverride?.name ?? group?.name ?? "Grupo removido",
      groupColor: groupOverride?.color ?? group?.color ?? "#18181b",
      creditCardPurchaseId: expense.creditCardPurchaseId,
      installmentNumber: expense.installmentNumber,
      installmentCount: expense.installmentCount,
    };
  });
  const spentByGroupId = new Map(
    groupSpentAggregation.map((item) => [item._id, item.spentAmount]),
  );

  const groupTotals = groups.map((group) => ({
    ...group,
    spentAmount: (spentByGroupId.get(group.id) ?? 0).toFixed(2),
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
        totalExpenses={totalExpenses}
        currentPage={currentPage}
      />
    </main>
  );
}
