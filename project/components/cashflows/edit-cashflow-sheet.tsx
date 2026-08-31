"use client";

import { useEffect, useState, type FormEvent } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/date-picker";
import { useSubmitState } from "@/lib/hooks/use-submit-state";

export type EditableCashflow = {
  _id: string;
  name: string;
  description: string | null;
  date: string;
  total: number;
  type: "income" | "expense";
  groupId: string | null;
};

type EditCashflowSheetProps = {
  userId: string;
  cashflow: EditableCashflow | null;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

export function EditCashflowSheet({ userId, cashflow, onOpenChange, onUpdated }: EditCashflowSheetProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState(0);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [groupId, setGroupId] = useState("");
  const { state, run, reset } = useSubmitState();

  useEffect(() => {
    if (!cashflow) return;

    setName(cashflow.name);
    setDescription(cashflow.description ?? "");
    setTotal(cashflow.total);
    setType(cashflow.type);
    setDate(new Date(cashflow.date));
    setGroupId(cashflow.groupId ?? "");
    reset();
  }, [cashflow, reset]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cashflow) return;

    const result = await run(async () => {
      if (total <= 0) {
        return { success: false as const, message: "Informe um valor maior que zero." };
      }

      const response = await fetch(`/api/v1/user/${userId}/cashflow/${cashflow._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
          date: date?.toISOString(),
          total,
          type,
          groupId: groupId || undefined,
        }),
      });
      const data = await response.json();

      if (response.ok && data.success) {
        return { success: true as const, message: "Lançamento atualizado com sucesso." };
      }
      return {
        success: false as const,
        message: data.message ?? "Erro ao atualizar lançamento.",
      };
    });

    if (result.success) {
      onUpdated?.();
      onOpenChange(false);
    }
  }

  return (
    <Sheet
      open={cashflow !== null}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) {
          reset();
        }
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Editar lançamento</SheetTitle>
          <SheetDescription>
            Atualize os dados do lançamento do usuário {userId}.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">Nome</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Salário"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Pagamento mensal"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-total">Valor</Label>
              <CurrencyInput id="edit-total" value={total} onChange={setTotal} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-type">Tipo</Label>
              <Select value={type} onValueChange={(value) => setType(value as "income" | "expense")}>
                <SelectTrigger id="edit-type" className="w-full">
                  <SelectValue>
                    {(value: "income" | "expense" | null) =>
                      value === "income" ? "Entrada" : "Saída"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Entrada</SelectItem>
                  <SelectItem value="expense">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Data</Label>
              <DatePicker value={date} onChange={setDate} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-groupId">ID do grupo (opcional)</Label>
              <Input
                id="edit-groupId"
                value={groupId}
                onChange={(event) => setGroupId(event.target.value)}
                placeholder="665f1c2e2f8b9a0012345678"
              />
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
            <Button type="submit" disabled={state.status === "loading"}>
              {state.status === "loading" ? "Salvando..." : "Salvar alterações"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
