"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarIcon,
  HandCoins,
  Pencil,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import {
  createExpenseGroup,
  createExtraIncome,
  deleteExpenseGroup,
  deleteExtraIncome,
  type ExpenseGroupActionState,
  updateExpenseGroup,
  updateExtraIncome,
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
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

const initialState: ExpenseGroupActionState = {};

export type ExpenseGroupView = {
  id: string;
  referenceMonth: string;
  name: string;
  monthlyAmount: string;
  affectsFutureMonths: boolean;
  color: string;
  description: string | null;
  updatedAt: string;
};

export type ExtraIncomeView = {
  id: string;
  referenceMonth: string;
  name: string;
  amount: string;
  description: string | null;
  updatedAt: string;
};

type ExpenseGroupsManagerProps = {
  groups: ExpenseGroupView[];
  extraIncomes: ExtraIncomeView[];
  selectedMonth: string;
  baseIncome: string;
  currency: string;
  mode: "planning" | "expenses";
};

function formatMoney(value: number | string, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number(value));
}

function formatPercent(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 1,
  }).format(value);
}

function formatReferenceMonth(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-").map(Number);

  if (!year || !month) {
    return referenceMonth;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function getShiftedMonth(referenceMonth: string, shift: number) {
  const [year, month] = referenceMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + shift, 1));

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function getDateFromReferenceMonth(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, 1));
}

function getReferenceMonthFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}`;
}

function getPercentage(amount: number, income: number) {
  if (income <= 0) {
    return 0;
  }

  return (amount / income) * 100;
}

function MonthSelector({ selectedMonth }: { selectedMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(getDateFromReferenceMonth(selectedMonth));
  const previousMonth = getShiftedMonth(selectedMonth, -1);
  const nextMonth = getShiftedMonth(selectedMonth, 1);

  function goToMonth(value: string) {
    router.push(`${pathname}?month=${value}`);
  }

  return (
    <Card>
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1.5">
          <CardTitle>Mes de referencia</CardTitle>
          <CardDescription>
            Planeje grupos e rendas extras para cada mes.
          </CardDescription>
        </div>
        <Badge variant="secondary" className="capitalize">
          {formatReferenceMonth(selectedMonth)}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="grid gap-2 sm:w-72">
          <Label htmlFor="referenceMonth">Mes</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                id="referenceMonth"
                type="button"
                variant="outline"
                className="justify-start font-normal capitalize"
              >
                <CalendarIcon />
                {formatReferenceMonth(getReferenceMonthFromDate(month))}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={month}
                month={month}
                onMonthChange={setMonth}
                onSelect={(date) => {
                  if (!date) {
                    return;
                  }

                  const selected = new Date(
                    Date.UTC(date.getFullYear(), date.getMonth(), 1),
                  );
                  setMonth(selected);
                  setOpen(false);
                  goToMonth(getReferenceMonthFromDate(selected));
                }}
                captionLayout="dropdown"
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => goToMonth(previousMonth)}
          >
            Anterior
          </Button>
          <Button
            type="button"
            onClick={() => goToMonth(getReferenceMonthFromDate(month))}
          >
            Abrir mes
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => goToMonth(nextMonth)}
          >
            Proximo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ExpenseGroupDialog({
  group,
  selectedMonth,
}: {
  group?: ExpenseGroupView;
  selectedMonth: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [affectsFutureMonths, setAffectsFutureMonths] = useState(
    group?.affectsFutureMonths ?? false,
  );
  const action = group ? updateExpenseGroup : createExpenseGroup;
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
        {group ? (
          <Button variant="outline" size="icon-sm" aria-label="Editar grupo">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            Novo grupo
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {group ? "Editar grupo de despesa" : "Novo grupo de despesa"}
          </DialogTitle>
          <DialogDescription>
            Registre quanto esse grupo tira da renda do mes selecionado.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-5">
          {group ? <input type="hidden" name="id" value={group.id} /> : null}
          <input
            type="hidden"
            name="referenceMonth"
            value={group?.referenceMonth ?? selectedMonth}
          />
          <input
            type="hidden"
            name="affectsFutureMonths"
            value={affectsFutureMonths ? "on" : ""}
          />

          <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
            <div className="grid gap-2">
              <Label htmlFor={`name-${group?.id ?? "new"}`}>Nome</Label>
              <Input
                id={`name-${group?.id ?? "new"}`}
                name="name"
                defaultValue={group?.name ?? ""}
                placeholder="Moradia, Alimentacao, Transporte..."
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`color-${group?.id ?? "new"}`}>Cor</Label>
              <Input
                id={`color-${group?.id ?? "new"}`}
                name="color"
                type="color"
                defaultValue={group?.color ?? "#18181b"}
                className="h-9 px-2"
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`monthlyAmount-${group?.id ?? "new"}`}>
              Valor no mes
            </Label>
            <Input
              id={`monthlyAmount-${group?.id ?? "new"}`}
              name="monthlyAmount"
              type="number"
              min="0"
              step="0.01"
              defaultValue={group?.monthlyAmount ?? "0.00"}
              required
            />
          </div>

          <div className="flex items-start gap-3 rounded-md border p-3">
            <Checkbox
              id={`affectsFutureMonths-${group?.id ?? "new"}`}
              checked={affectsFutureMonths}
              onCheckedChange={(checked) =>
                setAffectsFutureMonths(checked === true)
              }
            />
            <div className="grid gap-1.5">
              <Label htmlFor={`affectsFutureMonths-${group?.id ?? "new"}`}>
                Afeta os proximos meses
              </Label>
              <p className="text-sm text-muted-foreground">
                Quando marcado, este grupo entra neste mes e nos meses
                seguintes ate voce editar ou excluir.
              </p>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`description-${group?.id ?? "new"}`}>
              Descricao
            </Label>
            <Textarea
              id={`description-${group?.id ?? "new"}`}
              name="description"
              defaultValue={group?.description ?? ""}
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

function ExtraIncomeDialog({
  income,
  selectedMonth,
}: {
  income?: ExtraIncomeView;
  selectedMonth: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const action = income ? updateExtraIncome : createExtraIncome;
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
        {income ? (
          <Button variant="outline" size="icon-sm" aria-label="Editar renda extra">
            <Pencil />
          </Button>
        ) : (
          <Button variant="outline">
            <Plus />
            Renda extra
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {income ? "Editar renda extra" : "Adicionar renda extra"}
          </DialogTitle>
          <DialogDescription>
            Inclua qualquer entrada adicional do mes selecionado.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-5">
          {income ? <input type="hidden" name="id" value={income.id} /> : null}
          <input
            type="hidden"
            name="referenceMonth"
            value={income?.referenceMonth ?? selectedMonth}
          />

          <div className="grid gap-2">
            <Label htmlFor={`extra-name-${income?.id ?? "new"}`}>Nome</Label>
            <Input
              id={`extra-name-${income?.id ?? "new"}`}
              name="name"
              defaultValue={income?.name ?? ""}
              placeholder="Freela, bonus, emprestimo recebido..."
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`amount-${income?.id ?? "new"}`}>Valor</Label>
            <Input
              id={`amount-${income?.id ?? "new"}`}
              name="amount"
              type="number"
              min="0"
              step="0.01"
              defaultValue={income?.amount ?? "0.00"}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`extra-description-${income?.id ?? "new"}`}>
              Descricao
            </Label>
            <Textarea
              id={`extra-description-${income?.id ?? "new"}`}
              name="description"
              defaultValue={income?.description ?? ""}
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

function DeleteExpenseGroupButton({ group }: { group: ExpenseGroupView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpenseGroup(group.id);

      if (result.status === "success") {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(result.message ?? "Nao foi possivel remover o grupo.");
    });
  }

  return (
    <Button
      variant="destructive"
      size="icon-sm"
      aria-label="Excluir grupo"
      onClick={handleDelete}
      disabled={isPending}
    >
      <Trash2 />
    </Button>
  );
}

function DeleteExtraIncomeButton({ income }: { income: ExtraIncomeView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExtraIncome(income.id);

      if (result.status === "success") {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(result.message ?? "Nao foi possivel remover a renda extra.");
    });
  }

  return (
    <Button
      variant="destructive"
      size="icon-sm"
      aria-label="Excluir renda extra"
      onClick={handleDelete}
      disabled={isPending}
    >
      <Trash2 />
    </Button>
  );
}

export function ExpenseGroupsManager({
  groups,
  extraIncomes,
  selectedMonth,
  baseIncome,
  currency,
  mode,
}: ExpenseGroupsManagerProps) {
  const base = Number(baseIncome);
  const totalExtraIncome = extraIncomes.reduce(
    (total, income) => total + Number(income.amount),
    0,
  );
  const totalIncome = base + totalExtraIncome;
  const totalExpenses = groups.reduce(
    (total, group) => total + Number(group.monthlyAmount),
    0,
  );
  const remaining = totalIncome - totalExpenses;
  const committedPercentage = getPercentage(totalExpenses, totalIncome);

  return (
    <div className="grid gap-6">
      <MonthSelector selectedMonth={selectedMonth} />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        {mode === "expenses" ? (
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle>Grupos de despesas</CardTitle>
              <CardDescription>
                Despesas planejadas para {formatReferenceMonth(selectedMonth)}.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <ExtraIncomeDialog selectedMonth={selectedMonth} />
              <ExpenseGroupDialog selectedMonth={selectedMonth} />
            </div>
          </CardHeader>
          <CardContent>
            {groups.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Valor no mes</TableHead>
                    <TableHead>Impacto</TableHead>
                    <TableHead className="w-24 text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((group) => {
                    const amount = Number(group.monthlyAmount);
                    const percentage = getPercentage(amount, totalIncome);

                    return (
                      <TableRow key={group.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <span
                              className="size-3 rounded-full"
                              style={{ backgroundColor: group.color }}
                            />
                            <div>
                              <p className="font-medium">{group.name}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2">
                                <p className="text-sm text-muted-foreground">
                                  {group.description || "Sem descricao"}
                                </p>
                                {group.affectsFutureMonths ? (
                                  <Badge variant="outline">
                                    desde {formatReferenceMonth(group.referenceMonth)}
                                  </Badge>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatMoney(group.monthlyAmount, currency)}
                        </TableCell>
                        <TableCell>
                          <div className="grid min-w-40 gap-2">
                            <div className="flex items-center justify-between gap-3 text-sm">
                              <span className="text-muted-foreground">
                                {formatPercent(percentage)}%
                              </span>
                              <Badge
                                variant={percentage > 30 ? "destructive" : "secondary"}
                              >
                                da renda
                              </Badge>
                            </div>
                            <Progress value={Math.min(percentage, 100)} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <ExpenseGroupDialog
                              group={group}
                              selectedMonth={selectedMonth}
                            />
                            <DeleteExpenseGroupButton group={group} />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center gap-4 text-center">
                <WalletCards className="size-10 text-muted-foreground" />
                <div>
                  <h2 className="text-lg font-semibold">Nenhum grupo neste mes</h2>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Crie grupos para simular quanto cada parte do orcamento tira
                    da renda deste mes.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        ) : null}

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Controle mensal</CardTitle>
              <CardDescription className="capitalize">
                {formatReferenceMonth(selectedMonth)}
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Renda base</span>
                  <span className="font-medium">
                    {formatMoney(base, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    Renda extra
                  </span>
                  <span className="font-medium text-emerald-700">
                    {formatMoney(totalExtraIncome, currency)}
                  </span>
                </div>
              </div>
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground">Disponivel no mes</p>
                <p className="mt-1 text-2xl font-semibold">
                  {formatMoney(totalIncome, currency)}
                </p>
              </div>
              <Separator />
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    Total em grupos
                  </span>
                  <span className="font-medium">
                    {formatMoney(totalExpenses, currency)}
                  </span>
                </div>
                <Progress value={Math.min(committedPercentage, 100)} />
                <p className="text-sm text-muted-foreground">
                  {formatPercent(committedPercentage)}% da renda comprometida.
                </p>
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Sobra</span>
                <span
                  className={
                    remaining >= 0
                      ? "font-semibold text-emerald-700"
                      : "font-semibold text-red-700"
                  }
                >
                  {formatMoney(remaining, currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {mode === "planning" ? (
      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Rendas extras do mes</CardTitle>
            <CardDescription>
              Entradas adicionais que afetam apenas o mes selecionado.
            </CardDescription>
          </div>
          <ExtraIncomeDialog selectedMonth={selectedMonth} />
        </CardHeader>
        <CardContent>
          {extraIncomes.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead className="w-24 text-right">Acoes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extraIncomes.map((income) => (
                  <TableRow key={income.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <HandCoins className="size-4 text-emerald-700" />
                        <div>
                          <p className="font-medium">{income.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {income.description || "Sem descricao"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-emerald-700">
                      {formatMoney(income.amount, currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-2">
                        <ExtraIncomeDialog
                          income={income}
                          selectedMonth={selectedMonth}
                        />
                        <DeleteExtraIncomeButton income={income} />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center gap-4 text-center">
              <CalendarDays className="size-10 text-muted-foreground" />
              <div>
                <h2 className="text-lg font-semibold">Sem renda extra</h2>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Adicione bonus, freela, emprestimo recebido ou qualquer outra
                  entrada pontual deste mes.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      ) : null}
    </div>
  );
}
