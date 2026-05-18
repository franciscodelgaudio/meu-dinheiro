"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type ExpenseGroupActionState = {
  status?: "success" | "error";
  message?: string;
};

export type ExtraIncomeActionState = ExpenseGroupActionState;

type ExpenseGroupInput = {
  referenceMonth: string;
  name: string;
  monthlyAmount: string;
  affectsFutureMonths: boolean;
  color: string;
  description: string | null;
};

type ExtraIncomeInput = {
  referenceMonth: string;
  name: string;
  amount: string;
  description: string | null;
};

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

function parseExpenseGroupInput(formData: FormData): ExpenseGroupInput | string {
  const referenceMonth = String(formData.get("referenceMonth") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const monthlyAmountText = String(formData.get("monthlyAmount") ?? "")
    .trim()
    .replace(",", ".");
  const monthlyAmount = Number(monthlyAmountText);
  const affectsFutureMonths =
    String(formData.get("affectsFutureMonths") ?? "") === "on";
  const color = String(formData.get("color") ?? "#18181b").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!/^\d{4}-\d{2}$/.test(referenceMonth)) {
    return "Escolha um mes de referencia valido.";
  }

  if (name.length < 2) {
    return "Informe um nome com pelo menos 2 caracteres.";
  }

  if (!monthlyAmountText || !Number.isFinite(monthlyAmount) || monthlyAmount < 0) {
    return "Informe um valor mensal valido.";
  }

  if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
    return "Escolha uma cor valida para o grupo.";
  }

  return {
    referenceMonth,
    name,
    monthlyAmount: monthlyAmount.toFixed(2),
    affectsFutureMonths,
    color,
    description,
  };
}

function parseExtraIncomeInput(formData: FormData): ExtraIncomeInput | string {
  const referenceMonth = String(formData.get("referenceMonth") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const amountText = String(formData.get("amount") ?? "")
    .trim()
    .replace(",", ".");
  const amount = Number(amountText);
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!/^\d{4}-\d{2}$/.test(referenceMonth)) {
    return "Escolha um mes de referencia valido.";
  }

  if (name.length < 2) {
    return "Informe um nome com pelo menos 2 caracteres.";
  }

  if (!amountText || !Number.isFinite(amount) || amount < 0) {
    return "Informe um valor extra valido.";
  }

  return {
    referenceMonth,
    name,
    amount: amount.toFixed(2),
    description,
  };
}

export async function createExpenseGroup(
  _previousState: ExpenseGroupActionState,
  formData: FormData,
): Promise<ExpenseGroupActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const input = parseExpenseGroupInput(formData);

  if (typeof input === "string") {
    return { status: "error", message: input };
  }

  await prisma.expenseGroup.create({
    data: {
      userId,
      ...input,
    },
  });

  revalidatePath("/dashboard");
  return { status: "success", message: "Grupo de despesa criado." };
}

export async function updateExpenseGroup(
  _previousState: ExpenseGroupActionState,
  formData: FormData,
): Promise<ExpenseGroupActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const input = parseExpenseGroupInput(formData);

  if (!id) {
    return { status: "error", message: "Grupo de despesa nao encontrado." };
  }

  if (typeof input === "string") {
    return { status: "error", message: input };
  }

  const result = await prisma.expenseGroup.updateMany({
    where: { id, userId },
    data: input,
  });

  if (result.count === 0) {
    return { status: "error", message: "Grupo de despesa nao encontrado." };
  }

  revalidatePath("/dashboard");
  return { status: "success", message: "Grupo de despesa atualizado." };
}

export async function deleteExpenseGroup(
  id: string,
): Promise<ExpenseGroupActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const result = await prisma.expenseGroup.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    return { status: "error", message: "Grupo de despesa nao encontrado." };
  }

  revalidatePath("/dashboard");
  return { status: "success", message: "Grupo de despesa removido." };
}

export async function createExtraIncome(
  _previousState: ExtraIncomeActionState,
  formData: FormData,
): Promise<ExtraIncomeActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const input = parseExtraIncomeInput(formData);

  if (typeof input === "string") {
    return { status: "error", message: input };
  }

  await prisma.extraIncome.create({
    data: {
      userId,
      ...input,
    },
  });

  revalidatePath("/dashboard");
  return { status: "success", message: "Renda extra criada." };
}

export async function updateExtraIncome(
  _previousState: ExtraIncomeActionState,
  formData: FormData,
): Promise<ExtraIncomeActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const id = String(formData.get("id") ?? "").trim();
  const input = parseExtraIncomeInput(formData);

  if (!id) {
    return { status: "error", message: "Renda extra nao encontrada." };
  }

  if (typeof input === "string") {
    return { status: "error", message: input };
  }

  const result = await prisma.extraIncome.updateMany({
    where: { id, userId },
    data: input,
  });

  if (result.count === 0) {
    return { status: "error", message: "Renda extra nao encontrada." };
  }

  revalidatePath("/dashboard");
  return { status: "success", message: "Renda extra atualizada." };
}

export async function deleteExtraIncome(
  id: string,
): Promise<ExtraIncomeActionState> {
  const userId = await getCurrentUserId();

  if (!userId) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const result = await prisma.extraIncome.deleteMany({
    where: { id, userId },
  });

  if (result.count === 0) {
    return { status: "error", message: "Renda extra nao encontrada." };
  }

  revalidatePath("/dashboard");
  return { status: "success", message: "Renda extra removida." };
}
