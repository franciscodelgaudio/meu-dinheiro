import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Meu Dinheiro
      </h1>
      <Link href="/users/new" className="text-sm text-primary underline underline-offset-4">
        Criar usuário
      </Link>
    </div>
  );
}
