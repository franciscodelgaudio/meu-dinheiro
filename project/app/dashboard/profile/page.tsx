import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { dbConnect } from "@/lib/mongoose";
import { User } from "@/lib/models/user";
import { UserFinanceProfile } from "@/lib/models/user-finance-profile";

import { FinanceProfileManager } from "./finance-profile-manager";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  await dbConnect();
  const user = await User.findOne({ email: session.user.email })
    .select("_id name email image")
    .lean<{ _id: { toString(): string }; name: string | null; email: string | null; image: string | null }>();

  if (!user) {
    redirect("/login");
  }

  const fp = await UserFinanceProfile.findOne({ userId: user._id.toString() })
    .select("_id monthlyIncome currency paydayStart paydayEnd notes updatedAt")
    .lean<{
      _id: { toString(): string };
      monthlyIncome: number;
      currency: string;
      paydayStart: number | null;
      paydayEnd: number | null;
      notes: string | null;
      updatedAt: Date;
    }>();

  const profile = fp
    ? {
        id: fp._id.toString(),
        monthlyIncome: fp.monthlyIncome.toString(),
        currency: fp.currency,
        paydayStart: fp.paydayStart,
        paydayEnd: fp.paydayEnd,
        notes: fp.notes,
        updatedAt: fp.updatedAt.toISOString(),
      }
    : null;

  const userForForm = {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    image: user.image,
  };

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

      <ProfileForm user={userForForm} />
      <FinanceProfileManager key={profile?.id ?? "empty"} profile={profile} />
    </main>
  );
}
