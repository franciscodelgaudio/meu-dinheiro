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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitState } from "@/lib/hooks/use-submit-state";

type CreateGroupSheetProps = {
  userId: string;
  onCreated?: () => void;
};

export function CreateGroupSheet({ userId, onCreated }: CreateGroupSheetProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#18181b");
  const { state, run, reset } = useSubmitState();

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
      setColor("#18181b");
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
      <SheetTrigger render={<Button>Novo grupo</Button>} />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Criar grupo</SheetTitle>
          <SheetDescription>
            Cadastre um novo grupo de orçamento para o usuário {userId}.
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
              {state.status === "loading" ? "Criando..." : "Criar grupo"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
