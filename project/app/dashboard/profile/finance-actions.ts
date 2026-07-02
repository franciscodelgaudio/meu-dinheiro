"use server";

import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";
import { revalidatePath } from "next/cache";

export type FinanceActionState = {
  status?: "success" | "error";
  message?: string;
};

type FinanceInput = {
  currency: string;
  paydayStart: number | null;
  paydayEnd: number | null;
  notes: string | null;
};

async function getCurrentUserId() {
  const session = await auth();
  if (!session?.user?.email) return null;

  await dbConnect();
  const user = await User.findOne({ email: session.user.email })
    .select("_id")
    .lean<{ _id: { toString(): string } }>();

  return user ? user._id.toString() : null;
}

function parseOptionalInt(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const parsed = Number.parseInt(text, 10);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function isValidDay(value: number | null) {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 31);
}

function normalizeCurrency(value: FormDataEntryValue | null) {
  return String(value ?? "BRL").trim().toUpperCase().slice(0, 3);
}

function parseFinanceInput(formData: FormData): FinanceInput | string {
  const currency = normalizeCurrency(formData.get("currency"));
  const paydayStart = parseOptionalInt(formData.get("paydayStart"));
  const paydayEnd = parseOptionalInt(formData.get("paydayEnd"));
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (currency.length !== 3) return "Informe uma moeda com 3 letras, como BRL ou USD.";
  if (!isValidDay(paydayStart) || !isValidDay(paydayEnd)) return "Os dias precisam ficar entre 1 e 31.";
  if ((paydayStart === null) !== (paydayEnd === null)) {
    return "Informe o inicio e o fim do intervalo de recebimento.";
  }
  if (paydayStart !== null && paydayEnd !== null && paydayStart > paydayEnd) {
    return "O inicio do recebimento nao pode ser maior que o fim.";
  }

  return { currency, paydayStart, paydayEnd, notes };
}

export async function createFinanceProfile(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  const input = parseFinanceInput(formData);
  if (typeof input === "string") return { status: "error", message: input };

  const existingUser = await User.findOne({ _id: userId })
    .select("financeProfileCompletedAt")
    .lean<{ financeProfileCompletedAt: Date | null }>();
  if (existingUser?.financeProfileCompletedAt) {
    return { status: "error", message: "Voce ja tem um perfil financeiro." };
  }

  await User.updateOne(
    { _id: userId },
    { $set: { ...input, financeProfileCompletedAt: new Date() } },
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");

  return { status: "success", message: "Perfil financeiro criado." };
}

export async function updateFinanceProfile(
  _previousState: FinanceActionState,
  formData: FormData,
): Promise<FinanceActionState> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  const input = parseFinanceInput(formData);
  if (typeof input === "string") return { status: "error", message: input };

  const result = await User.updateOne(
    { _id: userId, financeProfileCompletedAt: { $ne: null } },
    { $set: input },
  );

  if (result.matchedCount === 0) return { status: "error", message: "Crie o perfil antes de atualizar." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");

  return { status: "success", message: "Perfil financeiro atualizado." };
}

export async function deleteFinanceProfile(): Promise<FinanceActionState> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  const result = await User.updateOne(
    { _id: userId, financeProfileCompletedAt: { $ne: null } },
    {
      $set: {
        currency: "BRL",
        paydayStart: null,
        paydayEnd: null,
        notes: null,
        financeProfileCompletedAt: null,
      },
    },
  );

  if (result.matchedCount === 0) return { status: "error", message: "Nenhum perfil financeiro encontrado." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");

  return { status: "success", message: "Perfil financeiro removido." };
}
