"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSubmitState } from "@/lib/hooks/use-submit-state";

export default function CreateUserPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const { state, run } = useSubmitState();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await run(async () => {
      const response = await fetch("/api/v1/user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // id é um identificador externo exigido pela API hoje, como stand-in
        // até existir autenticação real gerando esse valor.
        body: JSON.stringify({ id: crypto.randomUUID(), name, email }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        return { success: true as const, message: "Usuário criado com sucesso." };
      }
      return {
        success: false as const,
        message: data.message ?? "Erro ao criar usuário.",
      };
    });

    if (result.success) {
      setName("");
      setEmail("");
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Criar usuário</CardTitle>
          <CardDescription>
            Informe nome e e-mail para cadastrar um novo usuário.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ada Lovelace"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="ada@example.com"
                required
              />
            </div>
            {state.status === "error" && (
              <p className="text-sm text-destructive">{state.message}</p>
            )}
            {state.status === "success" && (
              <p className="text-sm text-primary">{state.message}</p>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              disabled={state.status === "loading"}
              className="w-full"
            >
              {state.status === "loading" ? "Criando..." : "Criar usuário"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
