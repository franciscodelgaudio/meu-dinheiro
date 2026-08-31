"use client";

import { useEffect, useState, type FormEvent } from "react";
import { XIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MonthPicker, formatMonthYear, type MonthYear } from "@/components/month-picker";
import { useSubmitState } from "@/lib/hooks/use-submit-state";

export type EditableGroup = {
  _id: string;
  name: string;
  description: string | null;
  date: { month: string; year: number }[];
  total: number;
  color: string | null;
};

type EditGroupSheetProps = {
  userId: string;
  group: EditableGroup | null;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

export function EditGroupSheet({ userId, group, onOpenChange, onUpdated }: EditGroupSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState(0);
  const [color, setColor] = useState("#18181b");
  const [months, setMonths] = useState<MonthYear[]>([]);
  const { state, run, reset } = useSubmitState();

  useEffect(() => {
    if (!group) return;

    setName(group.name);
    setDescription(group.description ?? "");
    setTotal(group.total);
    setColor(group.color ?? "#18181b");
    setMonths(group.date.map((item) => ({ month: item.month, year: String(item.year) })));
    reset();
  }, [group, reset]);

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
    if (!group) return;

    const result = await run(async () => {
      if (total <= 0) {
        return { success: false as const, message: "Informe um valor maior que zero." };
      }

      const response = await fetch(`/api/v1/user/${userId}/group/${group._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          date: months,
          total,
          color,
        }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        return { success: true as const, message: "Grupo atualizado com sucesso." };
      }
      return {
        success: false as const,
        message: data.message ?? "Erro ao atualizar grupo.",
      };
    });

    if (result.success) {
      onUpdated?.();
      onOpenChange(false);
    }
  }

  return (
    <Sheet
      open={group !== null}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          reset();
        }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Editar grupo</SheetTitle>
          <SheetDescription>
            Atualize os dados do grupo do usuário {userId}.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-group-name">Nome</Label>
              <Input
                id="edit-group-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Viagem para a praia"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-group-description">Descrição</Label>
              <Textarea
                id="edit-group-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Gastos da viagem de férias"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-group-total">Valor total</Label>
              <CurrencyInput id="edit-group-total" value={total} onChange={setTotal} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-group-color">Cor</Label>
              <div className="flex items-center gap-2">
                <input
                  id="edit-group-color"
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
          </div>
          <SheetFooter className="flex-row justify-end">
            <SheetClose render={<Button type="button" variant="outline" />}>
              Cancelar
            </SheetClose>
            <Button type="submit" disabled={state.status === "loading" || months.length === 0}>
              {state.status === "loading" ? "Salvando..." : "Salvar alterações"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
