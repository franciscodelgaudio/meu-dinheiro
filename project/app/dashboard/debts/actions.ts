"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type DebtActionState = {
  status?: "success" | "error";
  message?: string;
};

type DebtInput = {
  title: string;
  source: string;
  purchasedAt: Date;
  firstInstallmentMonth: string;
  totalAmount: number;
  installmentCount: number;
  description: string | null;
};

const DEBT_GROUP_NAME = "Dividas";
const DEBT_GROUP_COLOR = "#b91c1c";

async function getCurrentUserId() {
  const session = await auth();

  if (!session?.user?.email) {
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  return user?.id ?? null;
}

function parseDebtInput(formData: FormData): DebtInput | string {
  const title = String(formData.get("name") ?? "").trim();
  const source = String(formData.get("source") ?? "").trim();
  const purchasedAtText = String(formData.get("acquiredAt") ?? "").trim();
  const firstInstallmentMonth = String(
    formData.get("firstPaymentMonth") ?? "",
  ).trim();
  const totalAmountText = String(formData.get("totalAmount") ?? "")
    .trim()
    .replace(",", ".");
  const totalAmount = Number(totalAmountText);
  const installmentCountText = String(
    formData.get("installmentCount") ?? "1",
  ).trim();
  const installmentCount = Number(installmentCountText);
  const description = String(formData.get("description") ?? "").trim() || null;

  if (title.length < 2) {
    return "Informe um nome para a divida com pelo menos 2 caracteres.";
  }

  if (source.length < 2) {
    return "Informe de onde veio a divida.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchasedAtText)) {
    return "Informe uma data de origem valida.";
  }

  if (!/^\d{4}-\d{2}$/.test(firstInstallmentMonth)) {
    return "Escolha o primeiro mes de pagamento.";
  }

  if (!totalAmountText || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    return "Informe o valor total da divida.";
  }

  if (
    !installmentCountText ||
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > 240
  ) {
    return "Informe uma quantidade de parcelas entre 1 e 240.";
  }

  return {
    title,
    source,
    purchasedAt: new Date(`${purchasedAtText}T12:00:00.000Z`),
    firstInstallmentMonth,
    totalAmount,
    installmentCount,
    description,
  };
}

function addMonths(referenceMonth: string, monthsToAdd: number) {
  const [year, month] = referenceMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function getInstallmentDate(referenceMonth: string) {
  return new Date(`${referenceMonth}-01T12:00:00.000Z`);
}

function getReferenceMonth(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function getInstallmentAmounts(totalAmount: number, installmentCount: number) {
  const totalInCents = Math.round(totalAmount * 100);
  const baseInCents = Math.floor(totalInCents / installmentCount);
  const remainder = totalInCents % installmentCount;

  return Array.from({ length: installmentCount }, (_, index) => {
    const cents = baseInCents + (index < remainder ? 1 : 0);

    return (cents / 100).toFixed(2);
  });
}

async function ensureDebtGroup(userId: string, referenceMonth: string) {
  const existingGroup = await prisma.expenseGroup.findFirst({
    where: {
      userId,
      affectsFutureMonths: true,
      name: DEBT_GROUP_NAME,
    },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existingGroup) {
    return existingGroup.id;
  }

  const group = await prisma.expenseGroup.create({
    data: {
      userId,
      referenceMonth,
      name: DEBT_GROUP_NAME,
      monthlyAmount: "0.00",
      affectsFutureMonths: true,
      color: DEBT_GROUP_COLOR,
      description: "Grupo criado automaticamente para parcelas de dividas.",
    },
    select: { id: true },
  });

  return group.id;
}

async function syncDebtMonthlyAmount(
  userId: string,
  expenseGroupId: string,
  referenceMonth: string,
) {
  const [year, month] = referenceMonth.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  const total = await prisma.expense.aggregate({
    where: {
      userId,
      expenseGroupId,
      creditCardPurchase: { kind: "debt" },
      spentAt: {
        gte: start,
        lt: end,
      },
    },
    _sum: { amount: true },
  });
  const monthlyAmount = (total._sum.amount ?? 0).toString();

  await prisma.expenseGroupOverride.upsert({
    where: {
      expenseGroupId_referenceMonth: {
        expenseGroupId,
        referenceMonth,
      },
    },
    create: {
      userId,
      expenseGroupId,
      referenceMonth,
      name: DEBT_GROUP_NAME,
      monthlyAmount,
      color: DEBT_GROUP_COLOR,
      description: "Parcelas de dividas calculadas automaticamente.",
    },
    update: {
      name: DEBT_GROUP_NAME,
      monthlyAmount,
      color: DEBT_GROUP_COLOR,
      description: "Parcelas de dividas calculadas automaticamente.",
    },
  });
}

async function syncDebtMonths(
  userId: string,
  expenseGroupId: string,
  dates: Date[],
) {
  const referenceMonths = Array.from(new Set(dates.map(getReferenceMonth)));

  for (const referenceMonth of referenceMonths) {
    await syncDebtMonthlyAmount(userId, expenseGroupId, referenceMonth);
  }
}

export async function createDebt(
  _previousState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const input = parseDebtInput(formData);

  if (typeof input === "string") {
    return { status: "error", message: input };
  }

  const groupId = await ensureDebtGroup(userId, input.firstInstallmentMonth);
  const installmentAmounts = getInstallmentAmounts(
    input.totalAmount,
    input.installmentCount,
  );
  const referenceMonths = installmentAmounts.map((_, index) =>
    addMonths(input.firstInstallmentMonth, index),
  );

  await prisma.$transaction(async (tx) => {
    const commitment = await tx.creditCardPurchase.create({
      data: {
        userId,
        expenseGroupId: groupId,
        kind: "debt",
        source: input.source,
        purchasedAt: input.purchasedAt,
        firstInstallmentMonth: input.firstInstallmentMonth,
        title: input.title,
        totalAmount: input.totalAmount.toFixed(2),
        installmentAmount: installmentAmounts[0],
        installmentCount: input.installmentCount,
        description: input.description,
      },
      select: { id: true },
    });

    await tx.expense.createMany({
      data: installmentAmounts.map((amount, index) => {
        const installmentNumber = index + 1;
        const installmentLabel =
          input.installmentCount > 1
            ? `${input.title} (${installmentNumber}/${input.installmentCount})`
            : input.title;

        return {
          userId,
          expenseGroupId: groupId,
          creditCardPurchaseId: commitment.id,
          installmentNumber,
          installmentCount: input.installmentCount,
          spentAt: getInstallmentDate(referenceMonths[index]),
          title: installmentLabel,
          amount,
        };
      }),
    });
  });

  await syncDebtMonths(
    userId,
    groupId,
    referenceMonths.map(getInstallmentDate),
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/groups");

  return { status: "success", message: "Divida registrada." };
}

export async function updateDebt(
  _previousState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const input = parseDebtInput(formData);

  if (!id) {
    return { status: "error", message: "Divida nao encontrada." };
  }

  if (typeof input === "string") {
    return { status: "error", message: input };
  }

  const existing = await prisma.creditCardPurchase.findFirst({
    where: { id, userId, kind: "debt" },
    include: { expenses: { select: { spentAt: true } } },
  });

  if (!existing) {
    return { status: "error", message: "Divida nao encontrada." };
  }

  const groupId = existing.expenseGroupId;
  const oldDates = existing.expenses.map((expense) => expense.spentAt);
  const installmentAmounts = getInstallmentAmounts(
    input.totalAmount,
    input.installmentCount,
  );
  const referenceMonths = installmentAmounts.map((_, index) =>
    addMonths(input.firstInstallmentMonth, index),
  );

  await prisma.$transaction(async (tx) => {
    await tx.expense.deleteMany({
      where: { userId, creditCardPurchaseId: existing.id },
    });

    await tx.creditCardPurchase.update({
      where: { id: existing.id },
      data: {
        source: input.source,
        purchasedAt: input.purchasedAt,
        firstInstallmentMonth: input.firstInstallmentMonth,
        title: input.title,
        totalAmount: input.totalAmount.toFixed(2),
        installmentAmount: installmentAmounts[0],
        installmentCount: input.installmentCount,
        description: input.description,
      },
    });

    await tx.expense.createMany({
      data: installmentAmounts.map((amount, index) => {
        const installmentNumber = index + 1;
        const installmentLabel =
          input.installmentCount > 1
            ? `${input.title} (${installmentNumber}/${input.installmentCount})`
            : input.title;

        return {
          userId,
          expenseGroupId: groupId,
          creditCardPurchaseId: existing.id,
          installmentNumber,
          installmentCount: input.installmentCount,
          spentAt: getInstallmentDate(referenceMonths[index]),
          title: installmentLabel,
          amount,
        };
      }),
    });
  });

  await syncDebtMonths(userId, groupId, [
    ...oldDates,
    ...referenceMonths.map(getInstallmentDate),
  ]);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/groups");

  return { status: "success", message: "Divida atualizada." };
}

export async function deleteDebt(id: string): Promise<DebtActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const existing = await prisma.creditCardPurchase.findFirst({
    where: { id, userId, kind: "debt" },
    include: { expenses: { select: { spentAt: true } } },
  });

  if (!existing) {
    return { status: "error", message: "Divida nao encontrada." };
  }

  await prisma.creditCardPurchase.delete({
    where: { id: existing.id },
  });

  await syncDebtMonths(userId, existing.expenseGroupId, existing.expenses.map(
    (expense) => expense.spentAt,
  ));

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/groups");

  return { status: "success", message: "Divida removida." };
}
