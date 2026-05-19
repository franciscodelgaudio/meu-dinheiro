import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12">
      <section className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <p className="text-sm font-medium text-emerald-700">MeuDinheiro</p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950">
            Acesse sua conta
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            Acesse com sua conta Google para continuar.
          </p>
        </div>
        <LoginForm />
      </section>
    </main>
  );
}
