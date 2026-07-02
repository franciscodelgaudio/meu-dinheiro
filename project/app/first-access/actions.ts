"use server";

import { revalidatePath } from "next/cache";

import { auth, unstable_update as updateSession } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";

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
  if (!text) return null;
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

  await dbConnect();
  const user = await User.findOne({ email: session.user.email })
    .select("_id email image")
    .lean<{ _id: { toString(): string }; email: string | null; image: string | null }>();

  if (!user) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  const name = normalizeText(formData.get("name")) || null;
  const email = normalizeEmail(formData.get("email"));
  const currency = normalizeCurrency(formData.get("currency"));
  const paydayStart = parseOptionalInt(formData.get("paydayStart"));
  const paydayEnd = parseOptionalInt(formData.get("paydayEnd"));
  const notes = normalizeText(formData.get("notes")) || null;

  if (name && name.length > 80) return { status: "error", message: "O nome pode ter no maximo 80 caracteres." };
  if (!isValidEmail(email)) return { status: "error", message: "Informe um email valido." };
  if (currency.length !== 3) return { status: "error", message: "Informe uma moeda com 3 letras, como BRL ou USD." };
  if (!isValidDay(paydayStart) || !isValidDay(paydayEnd)) {
    return { status: "error", message: "Os dias precisam ficar entre 1 e 31." };
  }
  if ((paydayStart === null) !== (paydayEnd === null)) {
    return { status: "error", message: "Informe o inicio e o fim do intervalo de recebimento." };
  }
  if (paydayStart !== null && paydayEnd !== null && paydayStart > paydayEnd) {
    return { status: "error", message: "O inicio do recebimento nao pode ser maior que o fim." };
  }

  const userId = user._id.toString();

  if (email !== user.email) {
    const existingUser = await User.findOne({ email })
      .select("_id")
      .lean<{ _id: { toString(): string } }>();
    if (existingUser && existingUser._id.toString() !== userId) {
      return { status: "error", message: "Este email ja esta em uso." };
    }
  }

  const updatedUser = await User.findOneAndUpdate(
    { _id: userId },
    {
      $set: {
        name,
        email,
        currency,
        paydayStart,
        paydayEnd,
        notes,
        financeProfileCompletedAt: new Date(),
      },
    },
    { new: true, select: "name email image" },
  ).lean<{ name: string | null; email: string | null; image: string | null }>();

  if (updatedUser) {
    await updateSession({
      user: {
        name: updatedUser.name,
        email: updatedUser.email,
        image: updatedUser.image,
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/first-access");

  return { status: "success", message: "Primeiro acesso concluido." };
}
