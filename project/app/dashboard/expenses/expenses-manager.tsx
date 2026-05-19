"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarIcon,
  ImagePlus,
  CreditCard,
  Pencil,
  Plus,
  ReceiptText,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  analyzeQuickExpense,
  createCreditCardExpense,
  createExpense,
  createQuickExpenses,
  deleteExpense,
  type ExpenseActionState,
  type QuickExpenseActionState,
  updateExpense,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const initialState: ExpenseActionState = {};
const initialQuickState: QuickExpenseActionState = {};

export type ExpenseGroupOption = {
  id: string;
  referenceMonth: string;
  name: string;
  monthlyAmount: string;
  color: string;
};

export type ExpenseGroupTotal = ExpenseGroupOption & {
  spentAmount: string;
};

export type ExpenseView = {
  id: string;
  spentAt: string;
  title: string;
  amount: string;
  behaviorType: string;
  coverageDays: number;
  expenseGroupId: string;
  groupName: string;
  groupColor: string;
  creditCardPurchaseId?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
};

type ExpensesManagerProps = {
  groups: ExpenseGroupOption[];
  groupTotals: ExpenseGroupTotal[];
  expenses: ExpenseView[];
  selectedMonth: string;
  currency: string;
  paydayStart: number | null;
  paydayEnd: number | null;
  totalIncome: number;
};


function formatMoney(value: number | string, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(Number(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function formatDateInput(value: string) {
  return value.slice(0, 10);
}

function formatReferenceMonth(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-").map(Number);

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function getDefaultSpentAt(selectedMonth: string) {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}`;

  if (selectedMonth === currentMonth) {
    return `${selectedMonth}-${String(today.getDate()).padStart(2, "0")}`;
  }

  return `${selectedMonth}-01`;
}

function getPercentage(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return (value / total) * 100;
}

function getReferenceDate(selectedMonth: string) {
  const today = new Date();
  const currentMonth = `${today.getFullYear()}-${String(
    today.getMonth() + 1,
  ).padStart(2, "0")}`;

  if (selectedMonth === currentMonth) {
    return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  }

  const [year, month] = selectedMonth.split("-").map(Number);

  return new Date(Date.UTC(year, month - 1, 1));
}

function getDaysUntilNextPayday(
  selectedMonth: string,
  paydayStart: number | null,
) {
  const referenceDate = getReferenceDate(selectedMonth);
  const payday =
    paydayStart ??
    new Date(
      Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0),
    ).getUTCDate();
  const currentMonthLastDay = new Date(
    Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 1, 0),
  ).getUTCDate();
  let nextPayday = new Date(
    Date.UTC(
      referenceDate.getUTCFullYear(),
      referenceDate.getUTCMonth(),
      Math.min(payday, currentMonthLastDay),
    ),
  );

  if (nextPayday <= referenceDate) {
    const nextMonthLastDay = new Date(
      Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() + 2, 0),
    ).getUTCDate();

    nextPayday = new Date(
      Date.UTC(
        referenceDate.getUTCFullYear(),
        referenceDate.getUTCMonth() + 1,
        Math.min(payday, nextMonthLastDay),
      ),
    );
  }

  const dayMs = 24 * 60 * 60 * 1000;

  return Math.max(
    1,
    Math.ceil((nextPayday.getTime() - referenceDate.getTime()) / dayMs),
  );
}

function getPaydayLabel(paydayStart: number | null, paydayEnd: number | null) {
  if (paydayStart === null || paydayEnd === null) {
    return "fim do ciclo";
  }

  if (paydayStart === paydayEnd) {
    return `dia ${paydayStart}`;
  }

  return `dias ${paydayStart} a ${paydayEnd}`;
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

function QuickExpenseCapture({
  groups,
  selectedMonth,
}: {
  groups: ExpenseGroupOption[];
  selectedMonth: string;
}) {
  const router = useRouter();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [state, analyzeAction, isAnalyzing] = useActionState(
    analyzeQuickExpense,
    initialQuickState,
  );
  const [saveState, saveAction, isSaving] = useActionState(
    createQuickExpenses,
    initialState,
  );
  const suggestion = state.suggestion;
  const suggestionItems = suggestion?.items ?? [];

  useEffect(() => {
    if (!state.status || !state.message) {
      return;
    }

    if (state.status === "success" && state.suggestion) {
      window.setTimeout(() => {
        setPreviewOpen(true);
      }, 0);
      toast.success(state.message);
      return;
    }

    toast.error(state.message);
  }, [groups, state]);

  useEffect(() => {
    if (!saveState.status || !saveState.message) {
      return;
    }

    if (saveState.status === "success") {
      toast.success(saveState.message);
      window.setTimeout(() => {
        setPreviewOpen(false);
        router.refresh();
      }, 0);
      return;
    }

    toast.error(saveState.message);
  }, [router, saveState]);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="size-4" />
            Captura rapida
          </CardTitle>
          <CardDescription>
            Digite como voce falaria ou envie um print/nota. Voce confirma antes de salvar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={analyzeAction} className="grid gap-3">
            <input type="hidden" name="selectedMonth" value={selectedMonth} />
            <Textarea
              name="quickText"
              rows={2}
              placeholder="gastei 42 no bk hoje; mercado 280 reais pra semana; uber 23"
              className="min-h-20 resize-none"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
                <ImagePlus className="size-4" />
                Imagem
                <Input
                  name="quickImage"
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="sr-only"
                />
              </Label>
              <Button type="submit" disabled={isAnalyzing || groups.length === 0}>
                {isAnalyzing ? (
                  "Interpretando..."
                ) : (
                  <>
                    <Send />
                    Interpretar
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Confirmar gasto</DialogTitle>
            <DialogDescription>
              A IA preencheu o rascunho. Ajuste qualquer campo antes de salvar.
            </DialogDescription>
          </DialogHeader>

          {suggestion ? (
            <form action={saveAction} className="grid gap-5">
              <input type="hidden" name="rowCount" value={suggestionItems.length} />

              <div className="grid max-h-[55vh] gap-4 overflow-y-auto pr-1">
                {suggestionItems.map((item, index) => (
                  <div key={item.clientId} className="grid gap-4 rounded-md border p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">Linha {index + 1}</p>
                      <Badge variant={item.confidence >= 0.75 ? "secondary" : "outline"}>
                        {new Intl.NumberFormat("pt-BR", {
                          style: "percent",
                          maximumFractionDigits: 0,
                        }).format(item.confidence)}
                      </Badge>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[150px_1fr]">
                      <div className="grid gap-2">
                        <Label htmlFor={`quick-spentAt-${index}`}>Data</Label>
                        <Input
                          id={`quick-spentAt-${index}`}
                          name={`items.${index}.spentAt`}
                          type="date"
                          defaultValue={item.date}
                          required
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`quick-title-${index}`}>Descricao</Label>
                        <Input
                          id={`quick-title-${index}`}
                          name={`items.${index}.title`}
                          defaultValue={item.description}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                      <div className="grid gap-2">
                        <Label>Grupo</Label>
                        <select
                          name={`items.${index}.expenseGroupId`}
                          defaultValue={item.suggestedGroupId ?? groups[0]?.id ?? ""}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          required
                        >
                          {groups.map((group) => (
                            <option key={group.id} value={group.id}>
                              {group.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`quick-amount-${index}`}>Valor</Label>
                        <Input
                          id={`quick-amount-${index}`}
                          name={`items.${index}.amount`}
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={item.amount}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                      <div className="grid gap-2">
                        <Label>Comportamento</Label>
                        <select
                          name={`items.${index}.behaviorType`}
                          defaultValue={item.behaviorType}
                          className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                          required
                        >
                          <option value="single">Pontual</option>
                          <option value="stock">Cobre varios dias</option>
                          <option value="recurring">Recorrente</option>
                          <option value="emergency">Emergencia</option>
                        </select>
                      </div>
                      <div className="grid gap-2">
                        <Label htmlFor={`quick-coverageDays-${index}`}>
                          Cobre dias
                        </Label>
                        <Input
                          id={`quick-coverageDays-${index}`}
                          name={`items.${index}.coverageDays`}
                          type="number"
                          min="1"
                          max="365"
                          step="1"
                          defaultValue={item.coverageDays}
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-md bg-muted/60 p-3 text-sm">
                <span className="text-muted-foreground">Confianca da IA</span>
                <Badge variant={suggestion.confidence >= 0.75 ? "secondary" : "outline"}>
                  {new Intl.NumberFormat("pt-BR", {
                    style: "percent",
                    maximumFractionDigits: 0,
                  }).format(suggestion.confidence)}
                </Badge>
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancelar
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={isSaving || groups.length === 0}>
                  {isSaving ? "Salvando..." : "Confirmar gastos"}
                </Button>
              </DialogFooter>
            </form>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExpenseDialog({
  expense,
  groups,
  selectedMonth,
}: {
  expense?: ExpenseView;
  groups: ExpenseGroupOption[];
  selectedMonth: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState(
    expense?.expenseGroupId ?? groups[0]?.id ?? "",
  );
  const action = expense ? updateExpense : createExpense;
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
        {expense ? (
          <Button variant="outline" size="icon-sm" aria-label="Editar gasto">
            <Pencil />
          </Button>
        ) : (
          <Button disabled={groups.length === 0}>
            <Plus />
            Novo gasto
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar gasto" : "Novo gasto"}</DialogTitle>
          <DialogDescription>
            Informe data, descricao, grupo de despesas e quanto foi gasto.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-5">
          {expense ? <input type="hidden" name="id" value={expense.id} /> : null}
          <input type="hidden" name="expenseGroupId" value={selectedGroupId} />
          <input type="hidden" name="behaviorType" value="single" />
          <input type="hidden" name="coverageDays" value="1" />

          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="grid gap-2">
              <Label htmlFor={`spentAt-${expense?.id ?? "new"}`}>Data</Label>
              <Input
                id={`spentAt-${expense?.id ?? "new"}`}
                name="spentAt"
                type="date"
                defaultValue={
                  expense
                    ? formatDateInput(expense.spentAt)
                    : getDefaultSpentAt(selectedMonth)
                }
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`title-${expense?.id ?? "new"}`}>
                Descricao ou titulo
              </Label>
              <Input
                id={`title-${expense?.id ?? "new"}`}
                name="title"
                defaultValue={expense?.title ?? ""}
                placeholder="Mercado, aluguel, aplicativo..."
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <div className="grid gap-2">
              <Label>Grupo de despesas</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Escolha um grupo" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: group.color }}
                      />
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`amount-${expense?.id ?? "new"}`}>Valor</Label>
              <Input
                id={`amount-${expense?.id ?? "new"}`}
                name="amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue={expense?.amount ?? ""}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending || !selectedGroupId}>
              {isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreditCardExpenseDialog({ selectedMonth }: { selectedMonth: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    createCreditCardExpense,
    initialState,
  );

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
        <Button variant="secondary">
          <CreditCard />
          Compra parcelada
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Compra parcelada</DialogTitle>
          <DialogDescription>
            Lance uma compra que se divide em parcelas nos proximos meses.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-5">
          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="grid gap-2">
              <Label htmlFor="card-purchasedAt">Data da compra</Label>
              <Input
                id="card-purchasedAt"
                name="purchasedAt"
                type="date"
                defaultValue={getDefaultSpentAt(selectedMonth)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="card-title">Descricao ou titulo</Label>
              <Input
                id="card-title"
                name="title"
                placeholder="Tenis, maquina de lavar, mercado..."
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="card-firstInstallmentMonth">
                Primeiro mes da fatura
              </Label>
              <Input
                id="card-firstInstallmentMonth"
                name="firstInstallmentMonth"
                type="month"
                defaultValue={selectedMonth}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="card-paymentDay">Vencimento da fatura (dia)</Label>
              <Input
                id="card-paymentDay"
                name="paymentDay"
                type="number"
                min="1"
                max="31"
                step="1"
                placeholder="Ex: 10"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="card-totalAmount">Valor total</Label>
              <Input
                id="card-totalAmount"
                name="totalAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="card-installmentCount">Parcelas</Label>
              <Input
                id="card-installmentCount"
                name="installmentCount"
                type="number"
                min="1"
                max="120"
                step="1"
                defaultValue="1"
                required
              />
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Registrando..." : "Registrar parcelamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteExpenseButton({ expense }: { expense: ExpenseView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpense(expense.id);

      if (result.status === "success") {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(result.message ?? "Nao foi possivel remover o gasto.");
    });
  }

  return (
    <Button
      variant="destructive"
      size="icon-sm"
      aria-label="Excluir gasto"
      onClick={handleDelete}
      disabled={isPending}
    >
      <Trash2 />
    </Button>
  );
}

export function ExpensesManager({
  groups,
  groupTotals,
  expenses,
  selectedMonth,
  currency,
  paydayStart,
  paydayEnd,
  totalIncome,
}: ExpensesManagerProps) {
  const daysRemaining = getDaysUntilNextPayday(selectedMonth, paydayStart);
  const paydayLabel = getPaydayLabel(paydayStart, paydayEnd);
  const totalPlanned = useMemo(
    () => groupTotals.reduce((total, group) => total + Number(group.monthlyAmount), 0),
    [groupTotals],
  );
  const totalSpent = useMemo(
    () => expenses.reduce((total, expense) => total + Number(expense.amount), 0),
    [expenses],
  );
  const remaining = totalPlanned - totalSpent;
  const totalRemaining = totalIncome - totalSpent;
  const spentPercentage = getPercentage(totalSpent, totalPlanned);
  const sustainableDaily = totalRemaining > 0 ? totalRemaining / daysRemaining : 0;

  return (
    <div className="grid gap-4 sm:gap-6">
      <QuickExpenseCapture groups={groups} selectedMonth={selectedMonth} />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="gap-0 pb-0">
            <div className="flex items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle>Gastos registrados</CardTitle>
                <CardDescription className="mt-1 capitalize">
                  {formatReferenceMonth(selectedMonth)}
                </CardDescription>
              </div>
              <ExpenseDialog groups={groups} selectedMonth={selectedMonth} />
            </div>
            <div className="flex flex-col gap-2 border-t border-zinc-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
              <MonthSelector selectedMonth={selectedMonth} />
              <CreditCardExpenseDialog selectedMonth={selectedMonth} />
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {groups.length === 0 ? (
              <div className="flex min-h-56 flex-col items-center justify-center gap-4 px-6 pb-6 pt-4 text-center sm:p-0">
                <ReceiptText className="size-10 text-muted-foreground" />
                <div>
                  <h2 className="text-lg font-semibold">
                    Crie um grupo de despesas primeiro
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Os gastos precisam pertencer a um grupo, como Moradia,
                    Alimentacao ou Transporte.
                  </p>
                </div>
              </div>
            ) : expenses.length > 0 ? (
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="hidden sm:table-cell">Data</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="hidden sm:table-cell">Grupo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="w-20 text-right sm:w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="hidden whitespace-nowrap text-zinc-400 sm:table-cell">
                          {formatDate(expense.spentAt)}
                        </TableCell>
                        <TableCell>
                          <p className="font-medium">{expense.title}</p>
                          <p className="mt-0.5 text-xs text-zinc-400 sm:hidden">
                            {formatDate(expense.spentAt)}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1.5 sm:hidden">
                            <Badge variant="outline" className="gap-1.5 text-xs">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: expense.groupColor }}
                              />
                              {expense.groupName}
                            </Badge>
                            {expense.creditCardPurchaseId &&
                            expense.installmentNumber &&
                            expense.installmentCount ? (
                              <Badge variant="secondary" className="gap-1 text-xs">
                                <CreditCard className="size-3" />
                                {expense.installmentNumber}/{expense.installmentCount}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="gap-2">
                              <span
                                className="size-2 rounded-full"
                                style={{ backgroundColor: expense.groupColor }}
                              />
                              {expense.groupName}
                            </Badge>
                            {expense.creditCardPurchaseId &&
                            expense.installmentNumber &&
                            expense.installmentCount ? (
                              <Badge variant="secondary" className="gap-1">
                                <CreditCard className="size-3" />
                                {expense.installmentNumber}/{expense.installmentCount}
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-red-700">
                          {formatMoney(expense.amount, currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {expense.creditCardPurchaseId ? null : (
                              <ExpenseDialog
                                expense={expense}
                                groups={groups}
                                selectedMonth={selectedMonth}
                              />
                            )}
                            <DeleteExpenseButton expense={expense} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
            ) : (
              <div className="flex min-h-56 flex-col items-center justify-center gap-4 px-6 pb-6 pt-4 text-center sm:p-0">
                <ReceiptText className="size-10 text-muted-foreground" />
                <div>
                  <h2 className="text-lg font-semibold">
                    Nenhum gasto registrado
                  </h2>
                  <p className="mt-1 max-w-md text-sm text-muted-foreground">
                    Adicione um gasto para acompanhar o que ja saiu de cada
                    grupo neste mes.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="self-start">
          <CardHeader>
            <CardTitle>Resumo do mes</CardTitle>
            <CardDescription className="capitalize">
              {formatReferenceMonth(selectedMonth)}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  Planejado em grupos
                </span>
                <span className="font-medium">
                  {formatMoney(totalPlanned, currency)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  Gasto registrado
                </span>
                <span className="font-medium text-red-700">
                  {formatMoney(totalSpent, currency)}
                </span>
              </div>
            </div>
            <Separator />
            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Ate receber</span>
                <span className="font-medium">{daysRemaining} dia(s)</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">
                  Ritmo sustentavel
                </span>
                <span className="font-medium">
                  {formatMoney(sustainableDaily, currency)}/dia
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Calculado ate o proximo recebimento em {paydayLabel}.
              </p>
            </div>
            <Separator />
            <div className="grid gap-3">
              <Progress value={Math.min(spentPercentage, 100)} />
              <p className="text-sm text-muted-foreground">
                {new Intl.NumberFormat("pt-BR", {
                  maximumFractionDigits: 1,
                }).format(spentPercentage)}
                % do planejado ja foi usado.
              </p>
            </div>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Restante planejado
              </span>
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
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Restante real
              </span>
              <span
                className={
                  totalRemaining >= 0
                    ? "font-semibold text-emerald-700"
                    : "font-semibold text-red-700"
                }
              >
                {formatMoney(totalRemaining, currency)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {groupTotals.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Uso por grupo</CardTitle>
            <CardDescription>
              Comparacao entre o valor planejado e o que ja foi registrado.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Grupo</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Planejado</TableHead>
                  <TableHead className="text-right">Gasto</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Restante</TableHead>
                  <TableHead className="w-16 text-right sm:w-20">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {groupTotals.filter((g) => Number(g.monthlyAmount) > 0 || Number(g.spentAmount) > 0).map((group) => {
                  const planned = Number(group.monthlyAmount);
                  const spent = Number(group.spentAmount);
                  const groupRemaining = planned - spent;
                  const percentage = getPercentage(spent, planned);

                  return (
                    <TableRow key={group.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: group.color }}
                          />
                          <div>
                            <p className="font-medium">{group.name}</p>
                            <p className="text-xs text-muted-foreground sm:hidden">
                              {formatMoney(planned, currency)} planejado
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right whitespace-nowrap text-muted-foreground">
                        {formatMoney(planned, currency)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium text-red-700">
                        {formatMoney(spent, currency)}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right whitespace-nowrap">
                        <span className={groupRemaining < 0 ? "font-medium text-red-700" : "font-medium text-emerald-700"}>
                          {formatMoney(groupRemaining, currency)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={percentage > 100 ? "destructive" : "secondary"}>
                          {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(percentage)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
