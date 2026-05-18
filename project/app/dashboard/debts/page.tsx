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
  const commitments = await prisma.creditCardPurchase.findMany({
    where: {
      userId: user.id,
      kind: "debt",
      firstInstallmentMonth: { lte: selectedMonth },
    },
    orderBy: [{ firstInstallmentMonth: "asc" }, { createdAt: "desc" }],
  });

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
      const paidBeforeMonth = installmentAmounts
        .slice(0, selectedInstallmentIndex)
        .reduce((total, amount) => total + amount, 0);
      const installmentAmount = installmentAmounts[selectedInstallmentIndex] ?? 0;
      const remainingAfterMonth = installmentAmounts
        .slice(selectedInstallmentIndex + 1)
        .reduce((total, amount) => total + amount, 0);

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
        installmentNumber: selectedInstallmentIndex + 1,
        installmentAmount: installmentAmount.toFixed(2),
        paidBeforeMonth: paidBeforeMonth.toFixed(2),
        remainingAfterMonth: remainingAfterMonth.toFixed(2),
      };
    })
    .filter((debt) => debt !== null);

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">Dividas</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dividas</h1>
        <p className="mt-2 text-muted-foreground">
          Acompanhe emprestimos, financiamentos e obrigacoes financeiras com prazo definido.
        </p>
      </header>

      <DebtsManager
        debts={debtItems}
        selectedMonth={selectedMonth}
        currency={financeProfile?.currency ?? "BRL"}
      />
    </main>
  );
}
