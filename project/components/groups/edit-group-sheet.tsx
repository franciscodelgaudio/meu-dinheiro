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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitState } from "@/lib/hooks/use-submit-state";

export type EditableGroup = {
  _id: string;
  name: string;
  description: string | null;
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
  const [color, setColor] = useState("#18181b");
  const { state, run, reset } = useSubmitState();

  useEffect(() => {
    if (!group) return;

    setName(group.name);
    setDescription(group.description ?? "");
    setColor(group.color ?? "#18181b");
    reset();
  }, [group, reset]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!group) return;

    const result = await run(async () => {
      const response = await fetch(`/api/v1/user/${userId}/group/${group._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description: description || undefined,
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
