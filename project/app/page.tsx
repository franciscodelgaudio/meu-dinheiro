import { auth, signOut } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  ReceiptText,
  HandCoins,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CircleDollarSign,
} from "lucide-react";

const features = [
  {
    icon: LayoutDashboard,
    title: "Dashboard financeiro",
    description:
      "Visão consolidada da sua situação financeira em tempo real.",
  },
  {
    icon: ReceiptText,
    title: "Controle de gastos",
    description:
      "Organize despesas por grupos e acompanhe o impacto na sua renda.",
  },
  {
    icon: HandCoins,
    title: "Gestão de dívidas",
    description:
      "Monitore e planeje o pagamento das suas dívidas com clareza.",
  },
  {
    icon: TrendingUp,
    title: "Planejamento mensal",
    description:
      "Defina renda base, extras e metas para cada mês de referência.",
  },
  {
    icon: Sparkles,
    title: "Insights com IA",
    description:
      "Receba análises inteligentes sobre seus padrões financeiros.",
  },
  {
    icon: CircleDollarSign,
    title: "Visão em BRL",
    description:
      "Todos os valores formatados em reais, do jeito que você precisa.",
  },
];

export default async function Home() {
  const session = await auth();

  if (session?.user) redirect("/dashboard");

  return (
    <main className="flex min-h-screen flex-col bg-zinc-50">
      {/* Nav */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-base font-bold tracking-tight text-zinc-950">
            Meu<span className="text-emerald-600">Dinheiro</span>
          </span>

          {session?.user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Dashboard
                <ArrowRight size={14} />
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100"
                >
                  Sair
                </button>
              </form>
            </div>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-md border border-zinc-200 bg-white px-4 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
            >
              Entrar
            </Link>
          )}
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto flex w-full max-w-5xl flex-col items-center px-6 py-24 text-center">
        <span className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
          <Sparkles size={12} />
          Inteligência financeira pessoal
        </span>

        <h1 className="max-w-2xl text-5xl font-bold leading-tight tracking-tight text-zinc-950">
          Suas finanças,{" "}
          <span className="text-emerald-600">organizadas de verdade</span>
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-500">
          Planeje receitas, controle gastos por grupo, gerencie dívidas e
          receba insights com IA — tudo num só lugar.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
          {session?.user ? (
            <>
              <Link
                href="/dashboard"
                className="inline-flex h-11 items-center gap-2 rounded-md bg-zinc-950 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Abrir dashboard
                <ArrowRight size={15} />
              </Link>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="inline-flex h-11 items-center rounded-md border border-zinc-300 bg-white px-6 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
                >
                  Sair da conta
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-zinc-950 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Começar agora
              <ArrowRight size={15} />
            </Link>
          )}
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <Icon size={18} />
              </div>
              <h3 className="text-sm font-semibold text-zinc-950">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-500">
                {description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-white py-6 text-center text-xs text-zinc-400">
        MeuDinheiro · Feito para quem quer controlar o próprio futuro
      </footer>
    </main>
  );
}
