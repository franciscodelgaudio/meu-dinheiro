"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { createGroup } from "@/lib/actions/group";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MonthPicker } from "@/components/groups/MonthPicker";

type CreateGroupDialogProps = {
  userId: string;
};

function emptyForm(userId: string) {
  return {
    userId,
    name: "",
    description: "",
    referenceMonth: "",
    monthlyAmount: "0",
    color: "#18181b",
  };
}

export function CreateGroupDialog({ userId }: CreateGroupDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(() => emptyForm(userId));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await createGroup({
        userId: form.userId,
        name: form.name,
        description: form.description || null,
        referenceMonth: form.referenceMonth,
        monthlyAmount: Number(form.monthlyAmount),
        color: form.color,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setOpen(false);
      setForm(emptyForm(userId));
      router.refresh();
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setError(null);
      }}
    >
      <DialogTrigger render={<Button />}>
        <PlusIcon data-icon="inline-start" />
        Novo grupo
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo grupo de gastos</DialogTitle>
          <DialogDescription>
            Preencha os dados do grupo para este mês.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-user-id">Usuário</Label>
            <Input
              id="group-user-id"
              placeholder="ObjectId do usuário (24 caracteres hexadecimais)"
              value={form.userId ?? ""}
              onChange={(event) => setForm((f) => ({ ...f, userId: event.target.value }))}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-name">Nome</Label>
            <Input
              id="group-name"
              value={form.name ?? ""}
              onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="group-description">Descrição</Label>
            <Textarea
              id="group-description"
              value={form.description ?? ""}
              onChange={(event) => setForm((f) => ({ ...f, description: event.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Mês de referência</Label>
            <MonthPicker
              value={form.referenceMonth}
              onChange={(value) => setForm((f) => ({ ...f, referenceMonth: value }))}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex flex-1 flex-col gap-1.5">
              <Label htmlFor="group-amount">Valor mensal</Label>
              <Input
                id="group-amount"
                type="number"
                min="0"
                step="0.01"
                value={form.monthlyAmount ?? ""}
                onChange={(event) => setForm((f) => ({ ...f, monthlyAmount: event.target.value }))}
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="group-color">Cor</Label>
              <Input
                id="group-color"
                type="color"
                value={form.color ?? "#18181b"}
                onChange={(event) => setForm((f) => ({ ...f, color: event.target.value }))}
                className="h-8 w-14 p-1"
              />
            </div>
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Criar grupo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
