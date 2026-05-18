import { auth, signOut } from "@/auth";
import Link from "next/link";

export default async function Home() {
  const session = await auth();

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-6 py-12">
      <section className="w-full max-w-2xl">
        <p className="text-sm font-medium text-emerald-700">MeuDinheiro</p>
        <h1 className="mt-3 text-4xl font-semibold text-zinc-950">
          Auth.js configurado
        </h1>
        <p className="mt-4 max-w-xl text-lg leading-8 text-zinc-600">
          A aplicacao ja tem login com credenciais, sessao JWT e uma rota
          protegida para servir como base do painel financeiro.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          {session?.user ? (
            <>
              <Link
                className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
                href="/dashboard"
              >
                Abrir dashboard
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-medium text-zinc-800 transition hover:bg-zinc-100"
                  type="submit"
                >
                  Sair
                </button>
              </form>
            </>
          ) : (
            <Link
              className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              href="/login"
            >
              Entrar
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
