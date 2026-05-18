import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { name: true, email: true, image: true },
  });

  if (!user) {
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col gap-6 p-6">
      <header>
        <p className="text-sm font-medium text-muted-foreground">
          Configuracoes da conta
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Meu perfil
        </h1>
      </header>

      <ProfileForm user={user} />
    </main>
  );
}
