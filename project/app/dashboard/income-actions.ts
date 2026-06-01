"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function markIncomeReceived(referenceMonth: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Não autorizado");

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("Usuário não encontrado");

  await prisma.incomeReceipt.upsert({
    where: { userId_referenceMonth: { userId: user.id, referenceMonth } },
    create: { userId: user.id, referenceMonth },
    update: { receivedAt: new Date() },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
