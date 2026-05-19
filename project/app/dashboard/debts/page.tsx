import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";

import { DebtsManager } from "./debts-manager";

type DebtsPageProps = {
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
    select: { currency: true },
  });

  const [commitments, paidExpenses] = await Promise.all([
    prisma.creditCardPurchase.findMany({
      where: {
        userId: user.id,
        kind: { in: ["debt", "credit_card"] },
        firstInstallmentMonth: { lte: selectedMonth },
      },
      orderBy: [{ kind: "asc" }, { firstInstallmentMonth: "asc" }, { createdAt: "desc" }],
    }),
    prisma.expense.findMany({
      where: {
        userId: user.id,
        creditCardPurchaseId: { not: null },
      },
      select: {
        id: true,
        creditCardPurchaseId: true,
        installmentNumber: true,
      },
    }),
  ]);

  const paidMap = new Map(
    paidExpenses
      .filter((e) => e.creditCardPurchaseId != null && e.installmentNumber != null)
      .map((e) => [`${e.creditCardPurchaseId}-${e.installmentNumber}`, e.id]),
  );

  const debtItems = commitments
    .map((commitment) => {
      const selectedInstallmentIndex = getMonthDistance(
        commitment.firstInstallmentMonth,
        selectedMonth,
      );

      if (
        selectedInstallmentIndex < 0 ||
        selectedInstallmentIndex >= commitment.installmentCount
      ) {
        return null;
      }

      const installmentAmounts = getInstallmentAmounts(
        Number(commitment.totalAmount),
        commitment.installmentCount,
      );
      const installmentNumber = selectedInstallmentIndex + 1;
      const paidBeforeMonth = installmentAmounts
        .slice(0, selectedInstallmentIndex)
        .reduce((total, amount) => total + amount, 0);
      const installmentAmount = installmentAmounts[selectedInstallmentIndex] ?? 0;
      const remainingAfterMonth = installmentAmounts
        .slice(selectedInstallmentIndex + 1)
        .reduce((total, amount) => total + amount, 0);

      const payKey = `${commitment.id}-${installmentNumber}`;
      const paymentExpenseId = paidMap.get(payKey) ?? null;

      return {
        id: commitment.id,
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
