"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
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
import { GroupCombobox } from "@/components/cashflows/group-combobox";
import { useSubmitState } from "@/lib/hooks/use-submit-state";

type CreateCashflowSheetProps = {
  userId: string;
  onCreated?: () => void;
};

export function CreateCashflowSheet({ userId, onCreated }: CreateCashflowSheetProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [total, setTotal] = useState(0);
  const [type, setType] = useState<"income" | "expense">("expense");
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [groupId, setGroupId] = useState("");
  const { state, run, reset } = useSubmitState();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const result = await run(async () => {
      if (total <= 0) {
        return { success: false as const, message: "Informe um valor maior que zero." };
      }

      const response = await fetch(`/api/v1/user/${userId}/cashflow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
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
        return { success: true as const, message: "Lançamento criado com sucesso." };
      }
      return {
        success: false as const,
        message: data.message ?? "Erro ao criar lançamento.",
      };
    });

    if (result.success) {
      setName("");
      setDescription("");
      setTotal(0);
      setGroupId("");
      onCreated?.();
      setOpen(false);
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          reset();
        }
      }}
    >
      <SheetTrigger render={<Button>Novo lançamento</Button>} />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Criar lançamento</SheetTitle>
          <SheetDescription>
            Cadastre uma entrada ou saída financeira para o usuário {userId}.
          </SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Salário"
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Pagamento mensal"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="total">Valor</Label>
              <CurrencyInput id="total" value={total} onChange={setTotal} required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="type">Tipo</Label>
              <Select value={type} onValueChange={(value) => setType(value as "income" | "expense")}>
                <SelectTrigger id="type" className="w-full">
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
              <Label htmlFor="groupId">Grupo (opcional)</Label>
              <GroupCombobox id="groupId" userId={userId} value={groupId} onChange={setGroupId} />
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
              {state.status === "loading" ? "Criando..." : "Criar lançamento"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
