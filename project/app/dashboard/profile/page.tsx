import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { FinanceProfileManager } from "./finance-profile-manager";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  const financeProfile = await prisma.userFinanceProfile.findUnique({
    where: { userId: user.id },
    select: {
      id: true,
      monthlyIncome: true,
      currency: true,
      paydayStart: true,
      paydayEnd: true,
      notes: true,
      updatedAt: true,
    },
  });

  const profile = financeProfile
    ? {
        id: financeProfile.id,
        monthlyIncome: financeProfile.monthlyIncome.toString(),
        currency: financeProfile.currency,
        paydayStart: financeProfile.paydayStart,
        paydayEnd: financeProfile.paydayEnd,
        notes: financeProfile.notes,
        updatedAt: financeProfile.updatedAt.toISOString(),
      }
    : null;

  return (
    <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">
          Configuracoes da conta
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          Meu perfil
        </h1>
      </header>

      <ProfileForm user={user} />
      <FinanceProfileManager key={profile?.id ?? "empty"} profile={profile} />
    </main>
  );
}
