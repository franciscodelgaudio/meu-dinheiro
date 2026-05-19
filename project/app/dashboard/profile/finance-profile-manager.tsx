"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  createFinanceProfile,
  deleteFinanceProfile,
  type FinanceActionState,
  updateFinanceProfile,
} from "./finance-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";

const initialState: FinanceActionState = {};

export type FinanceProfileView = {
  id: string;
  monthlyIncome: string;
  currency: string;
  paydayStart: number | null;
  paydayEnd: number | null;
  notes: string | null;
  updatedAt: string;
} | null;

type FinanceProfileManagerProps = {
  profile: FinanceProfileView;
};

function formatMoney(value: string, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number(value));
}

function formatRange(start: number | null, end: number | null) {
  if (start === null || end === null) {
    return "Nao definido";
  }

  if (start === end) {
    return `Dia ${start}`;
  }

  return `Dias ${start} a ${end}`;
}

export function FinanceProfileManager({ profile }: FinanceProfileManagerProps) {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const saveProfile = profile ? updateFinanceProfile : createFinanceProfile;
  const [saveState, formAction, isSaving] = useActionState(
    saveProfile,
    initialState,
  );

  useEffect(() => {
    if (!saveState.status || !saveState.message) {
      return;
    }

    if (saveState.status === "success") {
      toast.success(saveState.message);
      window.setTimeout(() => {
        setDialogOpen(false);
        router.refresh();
      }, 0);
      return;
    }

    toast.error(saveState.message);
  }, [router, saveState]);

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteFinanceProfile();

      if (result.status === "success") {
        toast.success(result.message);
        setDeleteOpen(false);
        router.refresh();
        return;
      }

      toast.error(result.message ?? "Nao foi possivel remover o perfil.");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Perfil financeiro</CardTitle>
            <CardDescription>
              Dados recorrentes usados para estimar quando sua renda entra no
              caixa mensal.
            </CardDescription>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                {profile ? <Pencil /> : <Plus />}
                {profile ? "Editar" : "Criar perfil"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {profile ? "Editar perfil financeiro" : "Criar perfil financeiro"}
                </DialogTitle>
                <DialogDescription>
                  Configure a renda e o intervalo mensal em que voce recebe.
                </DialogDescription>
              </DialogHeader>

              <form action={formAction} className="grid gap-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="monthlyIncome">Renda mensal</Label>
                    <Input
                      id="monthlyIncome"
                      name="monthlyIncome"
                      type="number"
                      min="0"
                      step="0.01"
                      defaultValue={profile?.monthlyIncome ?? "0.00"}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="currency">Moeda</Label>
                    <Input
                      id="currency"
                      name="currency"
                      maxLength={3}
                      defaultValue={profile?.currency ?? "BRL"}
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
                      defaultValue={profile?.paydayStart ?? ""}
                    />
                    <Input
                      aria-label="Dia final do recebimento"
                      name="paydayEnd"
                      type="number"
                      min="1"
                      max="31"
                      placeholder="Ate o dia"
                      defaultValue={profile?.paydayEnd ?? ""}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="notes">Observacoes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={profile?.notes ?? ""}
                    rows={4}
                  />
                </div>

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">
                      Cancelar
                    </Button>
                  </DialogClose>
                  <Button type="submit" disabled={isSaving}>
                    {isSaving ? "Salvando..." : "Salvar"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {profile ? (
            <dl className="grid gap-4">
              <div className="grid gap-0.5">
                <dt className="text-xs font-medium text-muted-foreground">Renda mensal</dt>
                <dd className="text-sm font-medium">
                  {formatMoney(profile.monthlyIncome, profile.currency)}
                </dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-xs font-medium text-muted-foreground">Intervalo de recebimento</dt>
                <dd className="text-sm">
                  {formatRange(profile.paydayStart, profile.paydayEnd)}
                </dd>
              </div>
              {profile.notes && (
                <div className="grid gap-0.5">
                  <dt className="text-xs font-medium text-muted-foreground">Observacoes</dt>
                  <dd className="text-sm break-words">{profile.notes}</dd>
                </div>
              )}
            </dl>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-4 text-center">
              <CalendarDays className="size-10 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold">Nenhum perfil financeiro</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Crie um perfil para registrar sua renda e o intervalo mensal
                  em que voce recebe.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 content-start">
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
            <CardDescription>Status dos dados financeiros.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">Cadastro</span>
              <Badge variant={profile ? "default" : "secondary"}>
                {profile ? "Ativo" : "Pendente"}
              </Badge>
            </div>
            <Separator />
            <div>
              <p className="text-sm text-muted-foreground">Ultima atualizacao</p>
              <p className="mt-1 text-sm font-medium">
                {profile
                  ? new Intl.DateTimeFormat("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    }).format(new Date(profile.updatedAt))
                  : "Nao disponivel"}
              </p>
            </div>
          </CardContent>
        </Card>

        {profile ? (
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 />
                Excluir perfil
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Excluir perfil financeiro?</DialogTitle>
                <DialogDescription>
                  Esta acao remove renda, intervalo de recebimento e observacoes
                  do usuario atual.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Excluindo..." : "Excluir"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}
      </div>
    </div>
  );
}
