import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import Link from "next/link";
import { ArrowLeft, CircleDollarSign } from "lucide-react";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-12">
      {/* Back link */}
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-zinc-800"
      >
        <ArrowLeft size={14} />
        Voltar ao início
      </Link>

      <section className="w-full max-w-sm">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CircleDollarSign size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-950">
            Meu<span className="text-emerald-600">Dinheiro</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Entre para acessar seu painel financeiro
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="mb-4 text-center text-xs text-zinc-400">
            Faça login com sua conta Google para continuar
          </p>
          <LoginForm />
          <p className="mt-4 text-center text-xs leading-relaxed text-zinc-400">
            Ao entrar, você concorda com o uso dos seus dados para fins de
            personalização financeira.
          </p>
        </div>
      </section>
    </main>
  );
}
