"use server";

import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";
import { IncomeReceipt } from "@/lib/models/income-receipt";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function markIncomeReceived(referenceMonth: string) {
  const session = await auth();
  if (!session?.user?.email) throw new Error("Não autorizado");

  await dbConnect();
  const user = await User.findOne({ email: session.user.email })
    .select("_id")
    .lean<{ _id: { toString(): string } }>();

  if (!user) throw new Error("Usuário não encontrado");

  const userId = user._id.toString();

  await IncomeReceipt.findOneAndUpdate(
    { userId, referenceMonth },
    {
      $set: { receivedAt: new Date() },
      $setOnInsert: { userId, referenceMonth },
    },
    { upsert: true, new: true },
  );

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
