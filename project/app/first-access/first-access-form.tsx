"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BadgeCheck, CircleDollarSign, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import {
  completeFirstAccess,
  type FirstAccessActionState,
} from "./actions";

const initialState: FirstAccessActionState = {};

type FirstAccessFormProps = {
  user: {
    name: string | null;
    email: string | null;
    image: string | null;
  };
};

export function FirstAccessForm({ user }: FirstAccessFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(
    completeFirstAccess,
    initialState,
  );

  useEffect(() => {
    if (!state.status || !state.message) {
      return;
    }

    if (state.status === "success") {
      toast.success(state.message);
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    toast.error(state.message);
  }, [router, state]);

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BadgeCheck className="size-5 text-emerald-600" />
            Confirme seu acesso
          </CardTitle>
          <CardDescription>
            Revise seus dados e registre a base financeira inicial.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                name="name"
                defaultValue={user.name ?? ""}
                maxLength={80}
                placeholder="Seu nome"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={user.email ?? ""}
                placeholder="voce@email.com"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
            <div className="grid gap-2">
              <Label htmlFor="monthlyIncome">Renda mensal</Label>
              <Input
                id="monthlyIncome"
                name="monthlyIncome"
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="currency">Moeda</Label>
              <Input
                id="currency"
                name="currency"
                maxLength={3}
                defaultValue="BRL"
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Intervalo de recebimento mensal</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Dia inicial do recebimento"
                name="paydayStart"
                type="number"
                min="1"
                max="31"
                placeholder="Do dia"
              />
              <Input
                aria-label="Dia final do recebimento"
                name="paydayEnd"
                type="number"
                min="1"
                max="31"
                placeholder="Ate o dia"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Observacoes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={4}
              placeholder="Ex.: recebo adiantamento no meio do mes e o restante no fim."
            />
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Continuar"}
              <ArrowRight />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserRound className="size-5 text-emerald-600" />
              Conta Google
            </CardTitle>
            <CardDescription>Dados recebidos no login.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 text-center">
            <div className="flex size-24 items-center justify-center overflow-hidden rounded-full bg-primary text-2xl font-semibold text-primary-foreground">
              {user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.image}
                  alt=""
                  className="size-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <CircleDollarSign />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium">{user.name || "Sem nome"}</p>
              <p className="mt-1 break-all text-sm text-muted-foreground">
                {user.email}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </form>
  );
}
