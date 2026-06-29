import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";
import { UserFinanceProfile } from "@/lib/models/user-finance-profile";
import { CreditCardPurchase } from "@/lib/models/credit-card-purchase";
import { Expense } from "@/lib/models/expense";
import { IncomeReceipt } from "@/lib/models/income-receipt";
import { redirect } from "next/navigation";

import { DebtsManager } from "./debts-manager";
import { getCalendarMonth, getEffectiveCurrentMonth } from "@/lib/date-utils";

type DebtsPageProps = {
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

function getMonthDistance(startMonth: string, endMonth: string) {
  const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
  return (endYear - startYear) * 12 + (endMonthNumber - startMonthNumber);
}

function getInstallmentAmounts(totalAmount: number, installmentCount: number) {
  const totalInCents = Math.round(totalAmount * 100);
  const baseInCents = Math.floor(totalInCents / installmentCount);
  const remainder = totalInCents % installmentCount;
  return Array.from({ length: installmentCount }, (_, index) => {
    const cents = baseInCents + (index < remainder ? 1 : 0);
    return cents / 100;
  });
}

export default async function DebtsPage({ searchParams }: DebtsPageProps) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user?.email) redirect("/login");

  await dbConnect();
  const user = await User.findOne({ email: session.user.email })
    .select("_id")
    .lean<{ _id: { toString(): string } }>();

  if (!user) redirect("/login");

  const userId = user._id.toString();
  const calendarMonth = getCalendarMonth();

  const [financeProfile, incomeReceipt] = await Promise.all([
    UserFinanceProfile.findOne({ userId })
      .select("currency paydayStart")
      .lean<{ currency: string; paydayStart: number | null }>(),
    IncomeReceipt.findOne({ userId, referenceMonth: calendarMonth }).lean(),
  ]);

  const selectedMonth = normalizeReferenceMonth(
    params?.month,
    financeProfile?.paydayStart ?? null,
    incomeReceipt !== null,
  );

  const [commitments, paidExpenses] = await Promise.all([
    CreditCardPurchase.find({
      userId,
      kind: { $in: ["debt", "credit_card"] },
      firstInstallmentMonth: { $lte: selectedMonth },
    })
      .sort({ kind: 1, firstInstallmentMonth: 1, createdAt: -1 })
      .lean<{
        _id: { toString(): string };
        kind: string;
        title: string;
        source: string;
        purchasedAt: Date;
        firstInstallmentMonth: string;
        totalAmount: number;
        installmentCount: number;
        description: string | null;
        paymentDay: number | null;
      }[]>(),
    Expense.find({
      userId,
      creditCardPurchaseId: { $ne: null },
    })
      .select("_id creditCardPurchaseId installmentNumber")
      .lean<{ _id: { toString(): string }; creditCardPurchaseId: string; installmentNumber: number | null }[]>(),
  ]);

  const paidMap = new Map(
    paidExpenses
      .filter((e) => e.creditCardPurchaseId != null && e.installmentNumber != null)
      .map((e) => [`${e.creditCardPurchaseId}-${e.installmentNumber}`, e._id.toString()]),
  );

  const debtItems = commitments
    .map((commitment) => {
      const commitmentId = commitment._id.toString();
      const selectedInstallmentIndex = getMonthDistance(commitment.firstInstallmentMonth, selectedMonth);

      if (selectedInstallmentIndex < 0 || selectedInstallmentIndex >= commitment.installmentCount) {
        return null;
      }

      const installmentAmounts = getInstallmentAmounts(Number(commitment.totalAmount), commitment.installmentCount);
      const installmentNumber = selectedInstallmentIndex + 1;
      const paidBeforeMonth = installmentAmounts.slice(0, selectedInstallmentIndex).reduce((t, a) => t + a, 0);
      const installmentAmount = installmentAmounts[selectedInstallmentIndex] ?? 0;
      const remainingAfterMonth = installmentAmounts.slice(selectedInstallmentIndex + 1).reduce((t, a) => t + a, 0);

      const payKey = `${commitmentId}-${installmentNumber}`;
      const paymentExpenseId = paidMap.get(payKey) ?? null;

      return {
        id: commitmentId,
        kind: commitment.kind,
        name: commitment.title,
        source: commitment.source,
        acquiredAt: commitment.purchasedAt.toISOString(),
        firstPaymentMonth: commitment.firstInstallmentMonth,
        totalAmount: commitment.totalAmount.toString(),
        installmentCount: commitment.installmentCount,
        description: commitment.description,
        installmentNumber,
        installmentAmount: installmentAmount.toFixed(2),
        paidBeforeMonth: paidBeforeMonth.toFixed(2),
        remainingAfterMonth: remainingAfterMonth.toFixed(2),
        isPaid: paymentExpenseId !== null,
        paymentExpenseId,
        paymentDay: commitment.paymentDay,
      };
    })
    .filter((debt) => debt !== null);

  return (
    <main className="flex flex-1 flex-col gap-4 p-4 sm:gap-6 sm:p-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Finanças</p>
        <h1 className="mt-1 text-xl font-bold text-zinc-950 sm:text-2xl">Dívidas e Parcelados</h1>
      </header>

      <DebtsManager
        debts={debtItems}
        selectedMonth={selectedMonth}
        currency={financeProfile?.currency ?? "BRL"}
      />
    </main>
  );
}
