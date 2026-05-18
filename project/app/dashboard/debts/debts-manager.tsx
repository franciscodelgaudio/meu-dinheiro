"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarIcon,
  HandCoins,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createDebt,
  deleteDebt,
  type DebtActionState,
  updateDebt,
} from "./actions";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

const initialState: DebtActionState = {};

export type DebtView = {
  id: string;
  kind: string;
  name: string;
  source: string;
  acquiredAt: string | null;
  firstPaymentMonth: string;
  totalAmount: string;
  installmentCount: number;
  description: string | null;
  installmentNumber: number | null;
  installmentAmount: string;
  paidBeforeMonth: string;
  remainingAfterMonth: string;
};

type DebtsManagerProps = {
  debts: DebtView[];
  selectedMonth: string;
  currency: string;
};

function formatMoney(value: number | string, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number(value));
}

function formatReferenceMonth(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-").map(Number);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatDateInput(value: string | null) {
  return value?.slice(0, 10) ?? "";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Nao informado";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function MonthSelector({ selectedMonth }: { selectedMonth: string }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="relative">
      <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="month"
        value={selectedMonth}
        onChange={(event) => router.push(`${pathname}?month=${event.target.value}`)}
        className="w-[172px] pl-9"
        aria-label="Selecionar mes"
      />
    </div>
  );
}

function DebtDialog({
  debt,
  selectedMonth,
}: {
  debt?: DebtView;
  selectedMonth: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = debt ? updateDebt : createDebt;
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (!state.status || !state.message) {
      return;
    }

    if (state.status === "success") {
      toast.success(state.message);
      window.setTimeout(() => {
        setOpen(false);
        router.refresh();
      }, 0);
      return;
    }

    toast.error(state.message);
  }, [router, state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {debt ? (
          <Button variant="outline" size="icon-sm" aria-label="Editar divida">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            Nova divida
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{debt ? "Editar divida" : "Nova divida"}</DialogTitle>
          <DialogDescription>
            Registre emprestimos, compras combinadas ou valores que serao pagos
            em meses futuros.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-5">
          {debt ? <input type="hidden" name="id" value={debt.id} /> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`name-${debt?.id ?? "new"}`}>Nome</Label>
              <Input
                id={`name-${debt?.id ?? "new"}`}
                name="name"
                defaultValue={debt?.name ?? ""}
                placeholder="Emprestimo, notebook, acordo..."
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`source-${debt?.id ?? "new"}`}>
                De onde veio
              </Label>
              <Input
                id={`source-${debt?.id ?? "new"}`}
                name="source"
                defaultValue={debt?.source ?? ""}
                placeholder="Banco, pessoa, loja..."
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor={`acquiredAt-${debt?.id ?? "new"}`}>Origem</Label>
              <Input
                id={`acquiredAt-${debt?.id ?? "new"}`}
                name="acquiredAt"
                type="date"
                defaultValue={formatDateInput(debt?.acquiredAt ?? null)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`firstPaymentMonth-${debt?.id ?? "new"}`}>
                Primeiro pagamento
              </Label>
              <Input
                id={`firstPaymentMonth-${debt?.id ?? "new"}`}
                name="firstPaymentMonth"
                type="month"
                defaultValue={debt?.firstPaymentMonth ?? selectedMonth}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`installmentCount-${debt?.id ?? "new"}`}>
                Parcelas
              </Label>
              <Input
                id={`installmentCount-${debt?.id ?? "new"}`}
                name="installmentCount"
                type="number"
                min="1"
                max="240"
                step="1"
                defaultValue={debt?.installmentCount ?? 1}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`totalAmount-${debt?.id ?? "new"}`}>
              Valor total
            </Label>
            <Input
              id={`totalAmount-${debt?.id ?? "new"}`}
              name="totalAmount"
              type="number"
              min="0"
              step="0.01"
              defaultValue={debt?.totalAmount ?? ""}
              placeholder="0,00"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`description-${debt?.id ?? "new"}`}>Descricao</Label>
            <Textarea
              id={`description-${debt?.id ?? "new"}`}
              name="description"
              defaultValue={debt?.description ?? ""}
              rows={3}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDebtButton({ debt }: { debt: DebtView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteDebt(debt.id);

      if (result.status === "success") {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(result.message ?? "Nao foi possivel remover a divida.");
    });
  }

  return (
    <Button
      variant="destructive"
      size="icon-sm"
      aria-label="Excluir divida"
      onClick={handleDelete}
      disabled={isPending}
    >
      <Trash2 />
    </Button>
  );
}

export function DebtsManager({ debts, selectedMonth, currency }: DebtsManagerProps) {
  const monthlyDebtTotal = useMemo(
    () => debts.reduce((total, debt) => total + Number(debt.installmentAmount), 0),
    [debts],
  );
  const totalRemainingAfterMonth = useMemo(
    () => debts.reduce((total, debt) => total + Number(debt.remainingAfterMonth), 0),
    [debts],
  );
  const totalOriginal = useMemo(
    () => debts.reduce((total, debt) => total + Number(debt.totalAmount), 0),
    [debts],
  );
  const paidPercentage =
    totalOriginal > 0
      ? ((totalOriginal - totalRemainingAfterMonth) / totalOriginal) * 100
      : 0;

  return (
    <div className="grid gap-6">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Compromissos do mes</CardTitle>
              <CardDescription className="capitalize">
                {formatReferenceMonth(selectedMonth)}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <MonthSelector selectedMonth={selectedMonth} />
              <DebtDialog selectedMonth={selectedMonth} />
            </div>
          </CardHeader>
          <CardContent>
            {debts.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Compromisso</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Valor no mes</TableHead>
                    <TableHead className="w-24 text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debts.map((debt) => (
                    <TableRow key={debt.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{debt.name}</p>
                          <div className="mt-1 flex flex-wrap gap-2">
                            <Badge variant="secondary">Divida</Badge>
                            <p className="text-sm text-muted-foreground">
                              {debt.description || "Sem descricao"}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p>{debt.source}</p>
                          <p className="text-sm text-muted-foreground">
                            origem em {formatDate(debt.acquiredAt)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {debt.installmentNumber ? (
                          <Badge variant="outline">
                            {debt.installmentNumber}/{debt.installmentCount}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">fora do mes</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-medium text-red-700">
                        {formatMoney(debt.installmentAmount, currency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          {debt.kind === "debt" ? (
                            <>
                              <DebtDialog
                                debt={debt}
                                selectedMonth={selectedMonth}
                              />
                              <DeleteDebtButton debt={debt} />
                            </>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center gap-4 text-center">
                <ReceiptText className="size-10 text-muted-foreground" />
                <div>
                  <h2 className="text-lg font-semibold">
                    Nenhum compromisso para este mes
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Registre uma divida ou compra parcelada para ver quando ela
                    entra no seu orcamento.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Resumo de compromissos</CardTitle>
            <CardDescription className="capitalize">
              {formatReferenceMonth(selectedMonth)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div>
              <p className="text-sm text-muted-foreground">A pagar no mes</p>
              <p className="mt-1 text-2xl font-semibold text-red-700">
                {formatMoney(monthlyDebtTotal, currency)}
              </p>
            </div>
            <Separator />
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  Compromissos ativos
                </span>
                <span className="font-medium">{debts.length}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  Restante apos este mes
                </span>
                <span className="font-medium">
                  {formatMoney(totalRemainingAfterMonth, currency)}
                </span>
              </div>
            </div>
            <Separator />
            <div className="grid gap-3">
              <Progress value={Math.min(paidPercentage, 100)} />
              <p className="text-sm text-muted-foreground">
                {new Intl.NumberFormat("pt-BR", {
                  maximumFractionDigits: 1,
                }).format(paidPercentage)}
                % dos compromissos listados ja fica quitado ate este mes.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {debts.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Progresso por compromisso</CardTitle>
            <CardDescription>
              Quanto ja foi pago antes do mes selecionado e quanto sobra depois.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {debts.map((debt) => {
              const paidBefore = Number(debt.paidBeforeMonth);
              const total = Number(debt.totalAmount);
              const remaining = Number(debt.remainingAfterMonth);
              const paidAfterThisMonth = total - remaining;
              const percentage = total > 0 ? (paidAfterThisMonth / total) * 100 : 0;

              return (
                <div key={debt.id} className="grid gap-3 rounded-md border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{debt.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {debt.source}
                      </p>
                    </div>
                    <HandCoins className="size-4 text-red-700" />
                  </div>
                  <Progress value={Math.min(percentage, 100)} />
                  <div className="grid gap-1 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Antes do mes</span>
                      <span>{formatMoney(paidBefore, currency)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-muted-foreground">Depois do mes</span>
                      <span className="font-medium">
                        {formatMoney(remaining, currency)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
