"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="flex w-full flex-col gap-5">
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
        Email
        <input
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition focus:border-zinc-950"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue="admin@meudinheiro.local"
          required
        />
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700">
        Senha
        <input
          className="h-11 rounded-md border border-zinc-300 bg-white px-3 text-base text-zinc-950 outline-none transition focus:border-zinc-950"
          name="password"
          type="password"
          autoComplete="current-password"
          defaultValue="admin123"
          required
        />
      </label>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <button
        className="h-11 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={isPending}
      >
        {isPending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
