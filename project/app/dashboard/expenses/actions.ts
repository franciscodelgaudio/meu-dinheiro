"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  analyzeQuickExpenseWithAI,
  type QuickExpenseBatchSuggestion,
} from "./quick-capture";

export type ExpenseActionState = {
  status?: "success" | "error";
  message?: string;
};

export type QuickExpenseActionState = {
  status?: "success" | "error";
  message?: string;
  suggestion?: QuickExpenseBatchSuggestion;
};

type ExpenseInput = {
  spentAt: Date;
  title: string;
  expenseGroupId: string;
  amount: string;
  behaviorType: string;
  coverageDays: number;
};

type CreditCardExpenseInput = {
  purchasedAt: Date;
  firstInstallmentMonth: string;
  title: string;
  totalAmount: number;
  installmentCount: number;
};

const CREDIT_CARD_GROUP_NAME = "Cartao de credito";
const CREDIT_CARD_GROUP_COLOR = "#2563eb";
const EXPENSE_BEHAVIOR_TYPES = new Set([
  "single",
  "stock",
  "emergency",
  "daily",
  "stock_up",
  "recurring",
  "installment",
  "exceptional",
]);

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

function getTodayInputDate() {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(now.getDate()).padStart(2, "0")}`;
}

function normalizeReferenceMonth(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return value;
  }

  return getTodayInputDate().slice(0, 7);
}

function parseExpenseInput(formData: FormData): ExpenseInput | string {
  const spentAtText = String(formData.get("spentAt") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const expenseGroupId = String(formData.get("expenseGroupId") ?? "").trim();
  const amountText = String(formData.get("amount") ?? "")
    .trim()
    .replace(",", ".");
  const amount = Number(amountText);
  const behaviorType = String(formData.get("behaviorType") ?? "daily").trim();
  const coverageDaysText = String(formData.get("coverageDays") ?? "1").trim();
  const coverageDays = Number(coverageDaysText);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(spentAtText)) {
    return "Informe uma data valida.";
  }

  if (title.length < 2) {
    return "Informe uma descricao ou titulo com pelo menos 2 caracteres.";
  }

  if (!expenseGroupId) {
    return "Escolha um grupo de despesas.";
  }

  if (!amountText || !Number.isFinite(amount) || amount <= 0) {
    return "Informe quanto voce gastou.";
  }

  if (!EXPENSE_BEHAVIOR_TYPES.has(behaviorType)) {
    return "Escolha um tipo de comportamento valido para o gasto.";
  }

  if (
    !coverageDaysText ||
    !Number.isInteger(coverageDays) ||
    coverageDays < 1 ||
    coverageDays > 365
  ) {
    return "Informe quantos dias esse gasto cobre, entre 1 e 365.";
  }

  return {
    spentAt: new Date(`${spentAtText}T12:00:00.000Z`),
    title,
    expenseGroupId,
    amount: amount.toFixed(2),
    behaviorType,
    coverageDays,
  };
}

function parseCreditCardExpenseInput(
  formData: FormData,
): CreditCardExpenseInput | string {
  const purchasedAtText = String(formData.get("purchasedAt") ?? "").trim();
  const firstInstallmentMonth = String(
    formData.get("firstInstallmentMonth") ?? "",
  ).trim();
  const title = String(formData.get("title") ?? "").trim();
  const totalAmountText = String(formData.get("totalAmount") ?? "")
    .trim()
    .replace(",", ".");
  const totalAmount = Number(totalAmountText);
  const installmentCountText = String(
    formData.get("installmentCount") ?? "1",
  ).trim();
  const installmentCount = Number(installmentCountText);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchasedAtText)) {
    return "Informe uma data de compra valida.";
  }

  if (!/^\d{4}-\d{2}$/.test(firstInstallmentMonth)) {
    return "Escolha o primeiro mes da fatura.";
  }

  if (title.length < 2) {
    return "Informe uma descricao ou titulo com pelo menos 2 caracteres.";
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

  return {
    purchasedAt: new Date(`${purchasedAtText}T12:00:00.000Z`),
    firstInstallmentMonth,
    title,
    totalAmount,
    installmentCount,
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

function getInstallmentAmounts(totalAmount: number, installmentCount: number) {
  const totalInCents = Math.round(totalAmount * 100);
  const baseInCents = Math.floor(totalInCents / installmentCount);
  const remainder = totalInCents % installmentCount;

  return Array.from({ length: installmentCount }, (_, index) => {
    const cents = baseInCents + (index < remainder ? 1 : 0);

    return (cents / 100).toFixed(2);
  });
}

async function ensureCreditCardGroup(userId: string, referenceMonth: string) {
  const existingGroup = await prisma.expenseGroup.findFirst({
    where: {
      userId,
      affectsFutureMonths: true,
      name: CREDIT_CARD_GROUP_NAME,
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

async function syncCreditCardMonthlyAmount(
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
      name: CREDIT_CARD_GROUP_NAME,
      monthlyAmount,
      color: CREDIT_CARD_GROUP_COLOR,
      description: "Fatura calculada automaticamente pelas compras no cartao.",
    },
    update: {
      name: CREDIT_CARD_GROUP_NAME,
      monthlyAmount,
      color: CREDIT_CARD_GROUP_COLOR,
      description: "Fatura calculada automaticamente pelas compras no cartao.",
    },
  });
}

export async function createExpense(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const input = parseExpenseInput(formData);

  if (typeof input === "string") {
    return { status: "error", message: input };
  }

  const group = await prisma.expenseGroup.findFirst({
    where: { id: input.expenseGroupId, userId },
    select: { id: true },
  });

  if (!group) {
    return { status: "error", message: "Grupo de despesas nao encontrado." };
  }

  await prisma.expense.create({
    data: {
      userId,
      ...input,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/expenses");

  return { status: "success", message: "Gasto registrado." };
}

export async function createQuickExpenses(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const rowCount = Number(String(formData.get("rowCount") ?? "0"));

  if (!Number.isInteger(rowCount) || rowCount < 1 || rowCount > 20) {
    return { status: "error", message: "Nenhum gasto valido para salvar." };
  }

  const inputs: ExpenseInput[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const row = new FormData();
    row.set("spentAt", String(formData.get(`items.${index}.spentAt`) ?? ""));
    row.set("title", String(formData.get(`items.${index}.title`) ?? ""));
    row.set(
      "expenseGroupId",
      String(formData.get(`items.${index}.expenseGroupId`) ?? ""),
    );
    row.set("amount", String(formData.get(`items.${index}.amount`) ?? ""));
    row.set(
      "behaviorType",
      String(formData.get(`items.${index}.behaviorType`) ?? ""),
    );
    row.set(
      "coverageDays",
      String(formData.get(`items.${index}.coverageDays`) ?? ""),
    );

    const input = parseExpenseInput(row);

    if (typeof input === "string") {
      return {
        status: "error",
        message: `Linha ${index + 1}: ${input}`,
      };
    }

    inputs.push(input);
  }

  const groupIds = Array.from(new Set(inputs.map((input) => input.expenseGroupId)));
  const groupCount = await prisma.expenseGroup.count({
    where: {
      userId,
      id: { in: groupIds },
    },
  });

  if (groupCount !== groupIds.length) {
    return { status: "error", message: "Um dos grupos nao foi encontrado." };
  }

  await prisma.expense.createMany({
    data: inputs.map((input) => ({
      userId,
      ...input,
    })),
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/expenses");

  return {
    status: "success",
    message:
      inputs.length === 1
        ? "Gasto registrado."
        : `${inputs.length} gastos registrados.`,
  };
}

export async function analyzeQuickExpense(
  _previousState: QuickExpenseActionState,
  formData: FormData,
): Promise<QuickExpenseActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const text = String(formData.get("quickText") ?? "").trim();
  const image = formData.get("quickImage");
  const selectedMonth = normalizeReferenceMonth(
    String(formData.get("selectedMonth") ?? ""),
  );

  if (!text && !(image instanceof File && image.size > 0)) {
    return {
      status: "error",
      message: "Digite um gasto ou envie uma imagem para interpretar.",
    };
  }

  const groups = await prisma.expenseGroup.findMany({
    where: {
      userId,
      OR: [
        { referenceMonth: selectedMonth },
        { affectsFutureMonths: true, referenceMonth: { lt: selectedMonth } },
      ],
    },
    include: {
      overrides: {
        where: { userId, referenceMonth: selectedMonth },
        take: 1,
      },
    },
    orderBy: [{ referenceMonth: "desc" }, { createdAt: "desc" }],
  });

  if (groups.length === 0) {
    return {
      status: "error",
      message: "Crie um grupo de despesas antes de usar a captura rapida.",
    };
  }

  try {
    const suggestion = await analyzeQuickExpenseWithAI({
      text,
      image: image instanceof File ? image : undefined,
      groups: groups.map((group) => ({
        id: group.id,
        name: group.overrides[0]?.name ?? group.name,
      })),
      today: getTodayInputDate(),
      selectedMonth,
    });

    return {
      status: "success",
      message: "Gasto interpretado. Confira antes de salvar.",
      suggestion,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Nao foi possivel interpretar o gasto agora.",
    };
  }
}

export async function createCreditCardExpense(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const input = parseCreditCardExpenseInput(formData);

  if (typeof input === "string") {
    return { status: "error", message: input };
  }

  const groupId = await ensureCreditCardGroup(userId, input.firstInstallmentMonth);
  const installmentAmounts = getInstallmentAmounts(
    input.totalAmount,
    input.installmentCount,
  );
  const referenceMonths = installmentAmounts.map((_, index) =>
    addMonths(input.firstInstallmentMonth, index),
  );

  await prisma.$transaction(async (tx) => {
    const purchase = await tx.creditCardPurchase.create({
      data: {
        userId,
        expenseGroupId: groupId,
        kind: "credit_card",
        source: CREDIT_CARD_GROUP_NAME,
        purchasedAt: input.purchasedAt,
        firstInstallmentMonth: input.firstInstallmentMonth,
        title: input.title,
        totalAmount: input.totalAmount.toFixed(2),
        installmentAmount: installmentAmounts[0],
        installmentCount: input.installmentCount,
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
          creditCardPurchaseId: purchase.id,
          installmentNumber,
          installmentCount: input.installmentCount,
          spentAt: getInstallmentDate(referenceMonths[index]),
          title: installmentLabel,
          amount,
        };
      }),
    });
  });

  for (const referenceMonth of referenceMonths) {
    await syncCreditCardMonthlyAmount(userId, groupId, referenceMonth);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/groups");
  revalidatePath("/dashboard/expenses");

  return {
    status: "success",
    message:
      input.installmentCount > 1
        ? "Compra no cartao parcelada registrada."
        : "Compra no cartao registrada.",
  };
}

export async function updateExpense(
  _previousState: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const input = parseExpenseInput(formData);

  if (!id) {
    return { status: "error", message: "Gasto nao encontrado." };
  }

  if (typeof input === "string") {
    return { status: "error", message: input };
  }

  const group = await prisma.expenseGroup.findFirst({
    where: { id: input.expenseGroupId, userId },
    select: { id: true },
  });

  if (!group) {
    return { status: "error", message: "Grupo de despesas nao encontrado." };
  }

  const result = await prisma.expense.updateMany({
    where: { id, userId },
    data: input,
  });

  if (result.count === 0) {
    return { status: "error", message: "Gasto nao encontrado." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/expenses");

  return { status: "success", message: "Gasto atualizado." };
}

export async function deleteExpense(id: string): Promise<ExpenseActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const expense = await prisma.expense.findFirst({
    where: { id, userId },
    select: {
      expenseGroupId: true,
      spentAt: true,
      creditCardPurchaseId: true,
      expenseGroup: {
        select: { name: true },
      },
    },
  });

  if (!expense) {
    return { status: "error", message: "Gasto nao encontrado." };
  }

  await prisma.expense.delete({ where: { id } });

  if (
    expense.creditCardPurchaseId ||
    expense.expenseGroup.name === CREDIT_CARD_GROUP_NAME
  ) {
    const referenceMonth = `${expense.spentAt.getUTCFullYear()}-${String(
      expense.spentAt.getUTCMonth() + 1,
    ).padStart(2, "0")}`;

    await syncCreditCardMonthlyAmount(userId, expense.expenseGroupId, referenceMonth);
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/groups");
  revalidatePath("/dashboard/expenses");

  return { status: "success", message: "Gasto removido." };
}
