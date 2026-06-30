"use server";

import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";
import { ExpenseGroup } from "@/lib/models/expense-group";
import { ExpenseGroupOverride } from "@/lib/models/expense-group-override";
import { PlannedIncome } from "@/lib/models/planned-income";
import { SavingsAllocation } from "@/lib/models/savings-allocation";
import { revalidatePath } from "next/cache";

export type ExpenseGroupActionState = {
  status?: "success" | "error";
  message?: string;
};

export type PlannedIncomeActionState = ExpenseGroupActionState;
export type SavingsAllocationActionState = ExpenseGroupActionState;

type ExpenseGroupInput = {
  referenceMonth: string;
  name: string;
  monthlyAmount: number;
  affectsFutureMonths: boolean;
  repeatMonths: string | null;
  color: string;
  description: string | null;
};

type PlannedIncomeInput = {
  referenceMonth: string;
  amount: number;
  affectsFutureMonths: boolean;
  repeatMonths: string | null;
  description: string | null;
};

type SavingsAllocationInput = {
  referenceMonth: string;
  amount: number;
  affectsFutureMonths: boolean;
  repeatMonths: string | null;
  description: string | null;
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

function parseExpenseGroupInput(formData: FormData): ExpenseGroupInput | string {
  const referenceMonth = String(formData.get("referenceMonth") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const monthlyAmountText = String(formData.get("monthlyAmount") ?? "").trim().replace(",", ".");
  const monthlyAmount = Number(monthlyAmountText);
  const affectsFutureMonths = String(formData.get("affectsFutureMonths") ?? "") === "on";
  const color = String(formData.get("color") ?? "#18181b").trim();
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!/^\d{4}-\d{2}$/.test(referenceMonth)) return "Escolha um mes de referencia valido.";
  if (name.length < 2) return "Informe um nome com pelo menos 2 caracteres.";
  if (!monthlyAmountText || !Number.isFinite(monthlyAmount) || monthlyAmount < 0) return "Informe um valor mensal valido.";
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return "Escolha uma cor valida para o grupo.";

  let repeatMonths: string | null = null;
  if (affectsFutureMonths) {
    const raw = formData.getAll("repeatMonth").map((v) => Number(String(v)));
    const valid = [...new Set(raw.filter((n) => n >= 1 && n <= 12))].sort((a, b) => a - b);
    if (valid.length > 0 && valid.length < 12) {
      repeatMonths = valid.join(",");
    }
  }

  return {
    referenceMonth,
    name,
    monthlyAmount: Number(monthlyAmount.toFixed(2)),
    affectsFutureMonths,
    repeatMonths,
    color,
    description,
  };
}

function parsePlannedIncomeInput(formData: FormData): PlannedIncomeInput | string {
  const referenceMonth = String(formData.get("referenceMonth") ?? "").trim();
  const amountText = String(formData.get("amount") ?? "").trim().replace(",", ".");
  const amount = Number(amountText);
  const description = String(formData.get("description") ?? "").trim() || null;
  const affectsFutureMonths = String(formData.get("affectsFutureMonths") ?? "") === "on";

  if (!/^\d{4}-\d{2}$/.test(referenceMonth)) return "Escolha um mes de referencia valido.";
  if (!amountText || !Number.isFinite(amount) || amount < 0) return "Informe um valor de renda valido.";

  let repeatMonths: string | null = null;
  if (affectsFutureMonths) {
    const raw = formData.getAll("repeatMonth").map((v) => Number(String(v)));
    const valid = [...new Set(raw.filter((n) => n >= 1 && n <= 12))].sort((a, b) => a - b);
    if (valid.length > 0 && valid.length < 12) {
      repeatMonths = valid.join(",");
    }
  }

  return {
    referenceMonth,
    amount: Number(amount.toFixed(2)),
    affectsFutureMonths,
    repeatMonths,
    description,
  };
}

function parseSavingsAllocationInput(formData: FormData): SavingsAllocationInput | string {
  const referenceMonth = String(formData.get("referenceMonth") ?? "").trim();
  const amountText = String(formData.get("amount") ?? "").trim().replace(",", ".");
  const amount = Number(amountText);
  const description = String(formData.get("description") ?? "").trim() || null;
  const affectsFutureMonths = String(formData.get("affectsFutureMonths") ?? "") === "on";

  if (!/^\d{4}-\d{2}$/.test(referenceMonth)) return "Escolha um mes de referencia valido.";
  if (!amountText || !Number.isFinite(amount) || amount < 0) return "Informe um valor de poupanca valido.";

  let repeatMonths: string | null = null;
  if (affectsFutureMonths) {
    const raw = formData.getAll("repeatMonth").map((v) => Number(String(v)));
    const valid = [...new Set(raw.filter((n) => n >= 1 && n <= 12))].sort((a, b) => a - b);
    if (valid.length > 0 && valid.length < 12) {
      repeatMonths = valid.join(",");
    }
  }

  return {
    referenceMonth,
    amount: Number(amount.toFixed(2)),
    affectsFutureMonths,
    repeatMonths,
    description,
  };
}

export async function createExpenseGroup(
  _previousState: ExpenseGroupActionState,
  formData: FormData,
): Promise<ExpenseGroupActionState> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  const input = parseExpenseGroupInput(formData);
  if (typeof input === "string") return { status: "error", message: input };

  await dbConnect();
  await ExpenseGroup.create({ userId, ...input });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/groups");
  revalidatePath("/dashboard/expenses");

  return {
    status: "success",
    message: input.affectsFutureMonths
      ? "Grupo de despesa criado e copiado para os proximos meses."
      : "Grupo de despesa criado apenas neste mes.",
  };
}

export async function updateExpenseGroup(
  _previousState: ExpenseGroupActionState,
  formData: FormData,
): Promise<ExpenseGroupActionState> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  const id = String(formData.get("id") ?? "").trim();
  const input = parseExpenseGroupInput(formData);

  if (!id) return { status: "error", message: "Grupo de despesa nao encontrado." };
  if (typeof input === "string") return { status: "error", message: input };

  await dbConnect();
  const existingGroup = await ExpenseGroup.findOne({ _id: id, userId })
    .select("_id referenceMonth")
    .lean<{ _id: { toString(): string }; referenceMonth: string }>();

  if (!existingGroup) return { status: "error", message: "Grupo de despesa nao encontrado." };

  if (input.referenceMonth < existingGroup.referenceMonth) {
    return { status: "error", message: "Este grupo ainda nao existe no mes selecionado." };
  }

  const scope = String(formData.get("scope") ?? "this-month").trim();
  const applyFromNow = scope === "from-this-month";
  const groupId = existingGroup._id.toString();

  if (applyFromNow) {
    await ExpenseGroup.updateOne(
      { _id: groupId },
      {
        $set: {
          name: input.name,
          monthlyAmount: input.monthlyAmount,
          repeatMonths: input.repeatMonths,
          color: input.color,
          description: input.description,
        },
      },
    );
    await ExpenseGroupOverride.deleteMany({
      expenseGroupId: groupId,
      userId,
      referenceMonth: { $gte: input.referenceMonth },
    });
  } else {
    await ExpenseGroupOverride.findOneAndUpdate(
      { expenseGroupId: groupId, referenceMonth: input.referenceMonth },
      {
        $set: {
          userId,
          name: input.name,
          monthlyAmount: input.monthlyAmount,
          color: input.color,
          description: input.description,
        },
        $setOnInsert: { expenseGroupId: groupId, referenceMonth: input.referenceMonth },
      },
      { upsert: true, new: true },
    );
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/groups");
  revalidatePath("/dashboard/expenses");

  return {
    status: "success",
    message: applyFromNow ? "Grupo atualizado a partir deste mes." : "Grupo atualizado apenas neste mes.",
  };
}

export async function deleteExpenseGroup(id: string): Promise<ExpenseGroupActionState> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  await dbConnect();

  const { Expense } = await import("@/lib/models/expense");
  const { CreditCardPurchase } = await import("@/lib/models/credit-card-purchase");

  const hasExpenses = await Expense.countDocuments({ expenseGroupId: id, userId });
  if (hasExpenses > 0) {
    return {
      status: "error",
      message: "Nao e possivel remover um grupo que possui despesas registradas.",
    };
  }

  const hasPurchases = await CreditCardPurchase.countDocuments({ expenseGroupId: id, userId });
  if (hasPurchases > 0) {
    return {
      status: "error",
      message: "Nao e possivel remover um grupo que possui despesas registradas.",
    };
  }

  const result = await ExpenseGroup.deleteOne({ _id: id, userId });

  if (result.deletedCount === 0) return { status: "error", message: "Grupo de despesa nao encontrado." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/groups");

  return { status: "success", message: "Grupo de despesa removido." };
}

export async function createPlannedIncome(
  _previousState: PlannedIncomeActionState,
  formData: FormData,
): Promise<PlannedIncomeActionState> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  const input = parsePlannedIncomeInput(formData);
  if (typeof input === "string") return { status: "error", message: input };

  await dbConnect();
  await PlannedIncome.create({ userId, ...input });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/groups");

  return { status: "success", message: "Renda adicionada ao mes." };
}

export async function deletePlannedIncome(id: string): Promise<PlannedIncomeActionState> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  await dbConnect();
  const result = await PlannedIncome.deleteOne({ _id: id, userId });

  if (result.deletedCount === 0) return { status: "error", message: "Renda planejada nao encontrada." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/groups");

  return { status: "success", message: "Renda planejada removida." };
}

export async function saveSavingsAllocation(
  _previousState: SavingsAllocationActionState,
  formData: FormData,
): Promise<SavingsAllocationActionState> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  const input = parseSavingsAllocationInput(formData);
  if (typeof input === "string") return { status: "error", message: input };

  await dbConnect();
  await SavingsAllocation.findOneAndUpdate(
    { userId, referenceMonth: input.referenceMonth },
    {
      $set: {
        amount: input.amount,
        affectsFutureMonths: input.affectsFutureMonths,
        repeatMonths: input.repeatMonths,
        description: input.description,
      },
      $setOnInsert: { userId, referenceMonth: input.referenceMonth },
    },
    { upsert: true, new: true },
  );

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/groups");

  return { status: "success", message: "Poupanca do mes atualizada." };
}

export async function deleteSavingsAllocation(referenceMonth: string): Promise<SavingsAllocationActionState> {
  const userId = await getCurrentUserId();
  if (!userId) return { status: "error", message: "Sua sessao expirou. Entre novamente." };

  await dbConnect();
  const result = await SavingsAllocation.deleteOne({ userId, referenceMonth });

  if (result.deletedCount === 0) return { status: "error", message: "Poupanca nao encontrada." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/groups");

  return { status: "success", message: "Poupanca removida." };
}
