"use server";

import { revalidatePath } from "next/cache";

import { auth, unstable_update as updateSession } from "@/auth";
import { prisma } from "@/lib/prisma";

export type FirstAccessActionState = {
  status?: "success" | "error";
  message?: string;
};

function normalizeText(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: FormDataEntryValue | null) {
  return normalizeText(value).toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function parseOptionalInt(value: FormDataEntryValue | null) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isValidDay(value: number | null) {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 31);
}

function normalizeCurrency(value: FormDataEntryValue | null) {
  return normalizeText(value || "BRL").toUpperCase().slice(0, 3);
}

export async function completeFirstAccess(
  _previousState: FirstAccessActionState,
  formData: FormData,
): Promise<FirstAccessActionState> {
  const session = await auth();

  if (!session?.user?.email) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, email: true, image: true },
  });

  if (!user) {
    return { status: "error", message: "Sua sessao expirou. Entre novamente." };
  }

  const name = normalizeText(formData.get("name")) || null;
  const email = normalizeEmail(formData.get("email"));
  const monthlyIncomeText = normalizeText(formData.get("monthlyIncome")).replace(",", ".");
  const monthlyIncome = Number(monthlyIncomeText);
  const currency = normalizeCurrency(formData.get("currency"));
  const paydayStart = parseOptionalInt(formData.get("paydayStart"));
  const paydayEnd = parseOptionalInt(formData.get("paydayEnd"));
  const notes = normalizeText(formData.get("notes")) || null;

  if (name && name.length > 80) {
    return { status: "error", message: "O nome pode ter no maximo 80 caracteres." };
  }

  if (!isValidEmail(email)) {
    return { status: "error", message: "Informe um email valido." };
  }

  if (!monthlyIncomeText || !Number.isFinite(monthlyIncome) || monthlyIncome < 0) {
    return { status: "error", message: "Informe uma renda mensal valida." };
  }

  if (currency.length !== 3) {
    return { status: "error", message: "Informe uma moeda com 3 letras, como BRL ou USD." };
  }

  if (!isValidDay(paydayStart) || !isValidDay(paydayEnd)) {
    return { status: "error", message: "Os dias precisam ficar entre 1 e 31." };
  }

  if ((paydayStart === null) !== (paydayEnd === null)) {
    return { status: "error", message: "Informe o inicio e o fim do intervalo de recebimento." };
  }

  if (paydayStart !== null && paydayEnd !== null && paydayStart > paydayEnd) {
    return { status: "error", message: "O inicio do recebimento nao pode ser maior que o fim." };
  }

  if (email !== user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser && existingUser.id !== user.id) {
      return { status: "error", message: "Este email ja esta em uso." };
    }
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const savedUser = await tx.user.update({
      where: { id: user.id },
      data: { name, email },
      select: { name: true, email: true, image: true },
    });

    await tx.userFinanceProfile.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        monthlyIncome: monthlyIncome.toFixed(2),
        currency,
        paydayStart,
        paydayEnd,
        notes,
      },
      update: {
        monthlyIncome: monthlyIncome.toFixed(2),
        currency,
        paydayStart,
        paydayEnd,
        notes,
      },
    });

    return savedUser;
  });

  await updateSession({
    user: {
      name: updatedUser.name,
      email: updatedUser.email,
      image: updatedUser.image,
    },
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/first-access");

  return { status: "success", message: "Primeiro acesso concluido." };
}
