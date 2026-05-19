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
  paymentDay: number | null;
};

type CreditCardPurchaseInput = {
  title: string;
  purchasedAt: Date;
  firstInstallmentMonth: string;
  totalAmount: number;
  installmentCount: number;
  paymentDay: number | null;
};

const DEBT_GROUP_NAME = "Dividas";
const DEBT_GROUP_COLOR = "#b91c1c";
const CREDIT_CARD_GROUP_NAME = "Cartao de credito";
const CREDIT_CARD_GROUP_COLOR = "#2563eb";

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
  const paymentDayText = String(formData.get("paymentDay") ?? "").trim();
  const paymentDay = paymentDayText ? Number(paymentDayText) : null;

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

  if (
    paymentDay !== null &&
    (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31)
  ) {
    return "O dia de vencimento deve ser entre 1 e 31.";
  }

  return {
    title,
    source,
    purchasedAt: new Date(`${purchasedAtText}T12:00:00.000Z`),
    firstInstallmentMonth,
    totalAmount,
    installmentCount,
    description,
    paymentDay,
  };
}

function parseCreditCardPurchaseInput(
  formData: FormData,
): CreditCardPurchaseInput | string {
  const title = String(formData.get("title") ?? "").trim();
  const purchasedAtText = String(formData.get("purchasedAt") ?? "").trim();
  const firstInstallmentMonth = String(
    formData.get("firstInstallmentMonth") ?? "",
  ).trim();
  const totalAmountText = String(formData.get("totalAmount") ?? "")
    .trim()
    .replace(",", ".");
  const totalAmount = Number(totalAmountText);
  const installmentCountText = String(
    formData.get("installmentCount") ?? "1",
  ).trim();
  const installmentCount = Number(installmentCountText);
  const paymentDayText = String(formData.get("paymentDay") ?? "").trim();
  const paymentDay = paymentDayText ? Number(paymentDayText) : null;

  if (title.length < 2) {
    return "Informe o titulo da compra.";
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchasedAtText)) {
    return "Informe uma data de compra valida.";
  }

  if (!/^\d{4}-\d{2}$/.test(firstInstallmentMonth)) {
    return "Escolha o primeiro mes da fatura.";
  }

  if (!totalAmountText || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    return "Informe o valor total da compra.";
  }

  if (
    !installmentCountText ||
    !Number.isInteger(installmentCount) ||
    installmentCount < 1 ||
    installmentCount > 120
  ) {
    return "Informe uma quantidade de parcelas entre 1 e 120.";
  }

  if (
    paymentDay !== null &&
    (!Number.isInteger(paymentDay) || paymentDay < 1 || paymentDay > 31)
  ) {
    return "O dia de vencimento da fatura deve ser entre 1 e 31.";
  }

  return {
    title,
    purchasedAt: new Date(`${purchasedAtText}T12:00:00.000Z`),
    firstInstallmentMonth,
    totalAmount,
    installmentCount,
    paymentDay,
  };
}

function addMonths(referenceMonth: string, monthsToAdd: number) {
  const [year, month] = referenceMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + monthsToAdd, 1));

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
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

function getMonthDistance(startMonth: string, endMonth: string) {
  const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
  const [endYear, endMonthNumber] = endMonth.split("-").map(Number);

  return (endYear - startYear) * 12 + (endMonthNumber - startMonthNumber);
}

function getPurchaseMonths(firstInstallmentMonth: string, installmentCount: number): string[] {
  return Array.from({ length: installmentCount }, (_, i) =>
    addMonths(firstInstallmentMonth, i),
  );
}

async function ensureDebtGroup(userId: string, referenceMonth: string) {
  const existingGroup = await prisma.expenseGroup.findFirst({
    where: { userId, affectsFutureMonths: true, name: DEBT_GROUP_NAME },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existingGroup) return existingGroup.id;

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

async function ensureCreditCardGroup(userId: string, referenceMonth: string) {
  const existingGroup = await prisma.expenseGroup.findFirst({
    where: { userId, affectsFutureMonths: true, name: CREDIT_CARD_GROUP_NAME },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (existingGroup) return existingGroup.id;

  const group = await prisma.expenseGroup.create({
    data: {
      userId,
      referenceMonth,
      name: CREDIT_CARD_GROUP_NAME,
      monthlyAmount: "0.00",
      affectsFutureMonths: true,
      color: CREDIT_CARD_GROUP_COLOR,
      description: "Grupo criado automaticamente para compras no cartao.",
    },
    select: { id: true },
  });

  return group.id;
}

async function syncMonthlyAmount(
  userId: string,
  expenseGroupId: string,
  kind: "debt" | "credit_card",
  groupName: string,
  groupColor: string,
  referenceMonth: string,
) {
  const purchases = await prisma.creditCardPurchase.findMany({
    where: {
      userId,
      expenseGroupId,
      kind,
      firstInstallmentMonth: { lte: referenceMonth },
    },
    select: {
      totalAmount: true,
      installmentCount: true,
      firstInstallmentMonth: true,
    },
  });

  let totalValue = 0;

  for (const purchase of purchases) {
    const idx = getMonthDistance(purchase.firstInstallmentMonth, referenceMonth);

    if (idx >= 0 && idx < purchase.installmentCount) {
      const amounts = getInstallmentAmounts(
        Number(purchase.totalAmount),
        purchase.installmentCount,
      );
      totalValue += amounts[idx] ?? 0;
    }
  }

  if (totalValue === 0) {
    await prisma.expenseGroupOverride.deleteMany({
      where: { expenseGroupId, referenceMonth },
    });
    return;
  }

  await prisma.expenseGroupOverride.upsert({
    where: { expenseGroupId_referenceMonth: { expenseGroupId, referenceMonth } },
    create: {
      userId,
      expenseGroupId,
      referenceMonth,
      name: groupName,
      monthlyAmount: totalValue.toFixed(2),
      color: groupColor,
      description: "Calculado automaticamente pelas parcelas.",
    },
    update: {
      name: groupName,
      monthlyAmount: totalValue.toFixed(2),
      color: groupColor,
      description: "Calculado automaticamente pelas parcelas.",
    },
  });
}

async function syncMonths(
  userId: string,
  expenseGroupId: string,
  kind: "debt" | "credit_card",
  groupName: string,
  groupColor: string,
  referenceMonths: string[],
) {
  const uniqueMonths = Array.from(new Set(referenceMonths));

  for (const referenceMonth of uniqueMonths) {
    await syncMonthlyAmount(userId, expenseGroupId, kind, groupName, groupColor, referenceMonth);
  }
}

// ─── Debt actions ─────────────────────────────────────────────────────────────

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
  const installmentAmounts = getInstallmentAmounts(input.totalAmount, input.installmentCount);

  await prisma.creditCardPurchase.create({
    data: {
      userId,
      expenseGroupId: groupId,
      kind: "debt",
      source: input.source,
      purchasedAt: input.purchasedAt,
      firstInstallmentMonth: input.firstInstallmentMonth,
      title: input.title,
      totalAmount: input.totalAmount.toFixed(2),
      installmentAmount: installmentAmounts[0].toFixed(2),
      installmentCount: input.installmentCount,
      description: input.description,
      paymentDay: input.paymentDay,
    },
  });

  const months = getPurchaseMonths(input.firstInstallmentMonth, input.installmentCount);
  await syncMonths(userId, groupId, "debt", DEBT_GROUP_NAME, DEBT_GROUP_COLOR, months);

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
    select: { id: true, expenseGroupId: true, firstInstallmentMonth: true, installmentCount: true },
  });

  if (!existing) {
    return { status: "error", message: "Divida nao encontrada." };
  }

  const groupId = existing.expenseGroupId;
  const oldMonths = getPurchaseMonths(existing.firstInstallmentMonth, existing.installmentCount);
  const newMonths = getPurchaseMonths(input.firstInstallmentMonth, input.installmentCount);
  const installmentAmounts = getInstallmentAmounts(input.totalAmount, input.installmentCount);

  await prisma.creditCardPurchase.update({
    where: { id: existing.id },
    data: {
      source: input.source,
      purchasedAt: input.purchasedAt,
      firstInstallmentMonth: input.firstInstallmentMonth,
      title: input.title,
      totalAmount: input.totalAmount.toFixed(2),
      installmentAmount: installmentAmounts[0].toFixed(2),
      installmentCount: input.installmentCount,
      description: input.description,
      paymentDay: input.paymentDay,
    },
  });

  await syncMonths(userId, groupId, "debt", DEBT_GROUP_NAME, DEBT_GROUP_COLOR, [
    ...oldMonths,
    ...newMonths,
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
    select: { id: true, expenseGroupId: true, firstInstallmentMonth: true, installmentCount: true },
  });

  if (!existing) {
    return { status: "error", message: "Divida nao encontrada." };
  }

  const months = getPurchaseMonths(existing.firstInstallmentMonth, existing.installmentCount);

  await prisma.creditCardPurchase.delete({ where: { id: existing.id } });

  await syncMonths(userId, existing.expenseGroupId, "debt", DEBT_GROUP_NAME, DEBT_GROUP_COLOR, months);

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/groups");

  return { status: "success", message: "Divida removida." };
}

// ─── Credit card purchase actions ─────────────────────────────────────────────

export async function updateCreditCardPurchase(
  _previousState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const input = parseCreditCardPurchaseInput(formData);

  if (!id) {
    return { status: "error", message: "Compra nao encontrada." };
  }

  if (typeof input === "string") {
    return { status: "error", message: input };
  }

  const existing = await prisma.creditCardPurchase.findFirst({
    where: { id, userId, kind: "credit_card" },
    select: { id: true, expenseGroupId: true, firstInstallmentMonth: true, installmentCount: true },
  });

  if (!existing) {
    return { status: "error", message: "Compra nao encontrada." };
  }

  const groupId = existing.expenseGroupId;
  const oldMonths = getPurchaseMonths(existing.firstInstallmentMonth, existing.installmentCount);
  const newMonths = getPurchaseMonths(input.firstInstallmentMonth, input.installmentCount);
  const installmentAmounts = getInstallmentAmounts(input.totalAmount, input.installmentCount);

  await prisma.creditCardPurchase.update({
    where: { id: existing.id },
    data: {
      purchasedAt: input.purchasedAt,
      firstInstallmentMonth: input.firstInstallmentMonth,
      title: input.title,
      totalAmount: input.totalAmount.toFixed(2),
      installmentAmount: installmentAmounts[0].toFixed(2),
      installmentCount: input.installmentCount,
      paymentDay: input.paymentDay,
    },
  });

  await syncMonths(
    userId,
    groupId,
    "credit_card",
    CREDIT_CARD_GROUP_NAME,
    CREDIT_CARD_GROUP_COLOR,
    [...oldMonths, ...newMonths],
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/groups");

  return { status: "success", message: "Compra parcelada atualizada." };
}

export async function deleteCreditCardPurchase(id: string): Promise<DebtActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const existing = await prisma.creditCardPurchase.findFirst({
    where: { id, userId, kind: "credit_card" },
    select: { id: true, expenseGroupId: true, firstInstallmentMonth: true, installmentCount: true },
  });

  if (!existing) {
    return { status: "error", message: "Compra nao encontrada." };
  }

  const months = getPurchaseMonths(existing.firstInstallmentMonth, existing.installmentCount);

  await prisma.creditCardPurchase.delete({ where: { id: existing.id } });

  await syncMonths(
    userId,
    existing.expenseGroupId,
    "credit_card",
    CREDIT_CARD_GROUP_NAME,
    CREDIT_CARD_GROUP_COLOR,
    months,
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/groups");

  return { status: "success", message: "Compra parcelada removida." };
}

// ─── Pay / unpay (works for both debt and credit_card) ────────────────────────

export async function payInstallment(
  _previousState: DebtActionState,
  formData: FormData,
): Promise<DebtActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const creditCardPurchaseId = String(
    formData.get("creditCardPurchaseId") ?? "",
  ).trim();
  const installmentNumber = Number(formData.get("installmentNumber") ?? "0");
  const paidAtText = String(formData.get("paidAt") ?? "").trim();

  if (!creditCardPurchaseId || !installmentNumber || installmentNumber < 1) {
    return { status: "error", message: "Dados invalidos." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidAtText)) {
    return { status: "error", message: "Data de pagamento invalida." };
  }

  const purchase = await prisma.creditCardPurchase.findFirst({
    where: { id: creditCardPurchaseId, userId },
    select: {
      id: true,
      title: true,
      totalAmount: true,
      installmentCount: true,
      expenseGroupId: true,
    },
  });

  if (!purchase) {
    return { status: "error", message: "Compromisso nao encontrado." };
  }

  const installmentIndex = installmentNumber - 1;

  if (installmentIndex < 0 || installmentIndex >= purchase.installmentCount) {
    return { status: "error", message: "Parcela invalida." };
  }

  const alreadyPaid = await prisma.expense.findFirst({
    where: { creditCardPurchaseId: purchase.id, installmentNumber },
    select: { id: true },
  });

  if (alreadyPaid) {
    return { status: "error", message: "Esta parcela ja foi paga." };
  }

  const amounts = getInstallmentAmounts(
    Number(purchase.totalAmount),
    purchase.installmentCount,
  );
  const amount = amounts[installmentIndex];

  if (amount === undefined) {
    return { status: "error", message: "Parcela invalida." };
  }

  const title =
    purchase.installmentCount > 1
      ? `${purchase.title} (${installmentNumber}/${purchase.installmentCount})`
      : purchase.title;

  await prisma.expense.create({
    data: {
      userId,
      expenseGroupId: purchase.expenseGroupId,
      creditCardPurchaseId: purchase.id,
      installmentNumber,
      installmentCount: purchase.installmentCount,
      spentAt: new Date(`${paidAtText}T12:00:00.000Z`),
      title,
      amount: amount.toFixed(2),
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/expenses");

  return { status: "success", message: "Pagamento registrado." };
}

export async function unpayInstallment(expenseId: string): Promise<DebtActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, userId },
    select: { id: true },
  });

  if (!expense) {
    return { status: "error", message: "Pagamento nao encontrado." };
  }

  await prisma.expense.delete({ where: { id: expense.id } });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/debts");
  revalidatePath("/dashboard/expenses");

  return { status: "success", message: "Pagamento desfeito." };
}

// Keep old names as aliases so existing imports don't break
export { payInstallment as payDebtInstallment, unpayInstallment as unpayDebtInstallment };
