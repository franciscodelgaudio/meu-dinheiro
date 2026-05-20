import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, CircleDollarSign } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

import { FirstAccessForm } from "./first-access-form";

export default async function FirstAccessPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      name: true,
      email: true,
      image: true,
      financeProfile: { select: { id: true } },
    },
  });

  if (!user) {
    redirect("/login");
  }

  if (user.financeProfile) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-8 sm:px-6">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-6">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-800"
          >
            <ArrowLeft size={14} />
            Inicio
          </Link>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <CircleDollarSign size={22} />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                Primeiro acesso
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
                Vamos preparar seu painel
              </h1>
            </div>
            <p className="max-w-md text-sm leading-6 text-muted-foreground">
              Esses dados ajudam o MeuDinheiro a montar o resumo mensal e as
              analises iniciais com mais contexto.
            </p>
          </div>
        </header>

        <FirstAccessForm user={user} />
      </div>
    </main>
  );
}
