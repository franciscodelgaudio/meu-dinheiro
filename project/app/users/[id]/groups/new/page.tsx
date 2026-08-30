"use client";

import { useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { Textarea } from "@/components/ui/textarea";
import { MonthPicker, formatMonthYear, type MonthYear } from "@/components/month-picker";
import { useSubmitState } from "@/lib/hooks/use-submit-state";

export default function CreateGroupPage() {
  const { id: userId } = useParams<{ id: string }>();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState("");
  const [color, setColor] = useState("#18181b");
  const [months, setMonths] = useState<MonthYear[]>([]);
  const { state, run } = useSubmitState();

  function addMonth(value: MonthYear) {
    setMonths((current) =>
      current.some((item) => item.month === value.month && item.year === value.year)
        ? current
        : [...current, value],
    );
  }

  function removeMonth(value: MonthYear) {
    setMonths((current) =>
      current.filter((item) => !(item.month === value.month && item.year === value.year)),
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await run(async () => {
      const response = await fetch(`/api/v1/user/${userId}/group`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          date: months,
          total: Number(total),
          color,
        }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        return { success: true as const, message: "Grupo criado com sucesso." };
      }
      return {
        success: false as const,
        message: data.message ?? "Erro ao criar grupo.",
      };
    });

    if (result.success) {
      setName("");
      setDescription("");
      setTotal("");
      setMonths([]);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Criar grupo</CardTitle>
          <CardDescription>
            Cadastre um novo grupo de orçamento para o usuário {userId}.
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
                placeholder="Viagem para a praia"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Gastos da viagem de férias"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="total">Valor total</Label>
              <Input
                id="total"
                type="number"
                min={1}
                step="0.01"
                value={total}
                onChange={(event) => setTotal(event.target.value)}
                placeholder="1500"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="color">Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                  className="h-8 w-10 rounded-md border border-input bg-transparent"
                />
                <span className="text-sm text-muted-foreground">{color}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Meses cobertos</Label>
              <div className="flex flex-wrap items-center gap-2">
                {months.map((item) => (
                  <Badge key={`${item.month}-${item.year}`} variant="secondary" className="gap-1">
                    {formatMonthYear(item)}
                    <button
                      type="button"
                      onClick={() => removeMonth(item)}
                      aria-label="Remover mês"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </Badge>
                ))}
                <MonthPicker onSelect={addMonth} />
              </div>
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
              disabled={state.status === "loading" || months.length === 0}
              className="w-full"
            >
              {state.status === "loading" ? "Criando..." : "Criar grupo"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
