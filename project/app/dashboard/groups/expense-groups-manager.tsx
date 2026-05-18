"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  HandCoins,
  Pencil,
  PiggyBank,
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
  deleteSavingsAllocation,
  type ExpenseGroupActionState,
  saveSavingsAllocation,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const initialState: ExpenseGroupActionState = {};

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

export type ExpenseGroupView = {
  id: string;
  referenceMonth: string;
  name: string;
  monthlyAmount: string;
  affectsFutureMonths: boolean;
  color: string;
  description: string | null;
  priority: string;
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

export type SavingsAllocationView = {
  id: string;
  referenceMonth: string;
  amount: string;
  description: string | null;
  updatedAt: string;
};

export type YearMonthSummary = {
  month: string;
  totalExpenses: number;
  totalExtraIncome: number;
  savings: number;
  totalIncome: number;
  totalCommitments: number;
  remaining: number;
};

type ExpenseGroupsManagerProps = {
  groups: ExpenseGroupView[];
  extraIncomes: ExtraIncomeView[];
  savingsAllocation: SavingsAllocationView | null;
  selectedMonth: string;
  baseIncome: string;
  currency: string;
  mode: "planning" | "expenses";
  view?: "month" | "year";
  yearData?: YearMonthSummary[];
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

function formatMonthShort(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-").map(Number);

  if (!year || !month) {
    return referenceMonth;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
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

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function ViewToggle({
  view,
  selectedMonth,
}: {
  view: "month" | "year";
  selectedMonth: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex overflow-hidden rounded-md border">
      <Button
        type="button"
        variant={view === "month" ? "default" : "ghost"}
        size="sm"
        className="rounded-none border-0"
        onClick={() =>
          router.push(`${pathname}?month=${selectedMonth}&view=month`)
        }
      >
        Mês
      </Button>
      <Separator orientation="vertical" />
      <Button
        type="button"
        variant={view === "year" ? "default" : "ghost"}
        size="sm"
        className="rounded-none border-0"
        onClick={() => {
          const year = selectedMonth.split("-")[0];
          router.push(`${pathname}?month=${year}-01&view=year`);
        }}
      >
        Ano
      </Button>
    </div>
  );
}

function YearSelector({ selectedMonth }: { selectedMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const parts = selectedMonth.split("-");
  const year = Number(parts[0]);
  const monthPad = parts[1] ?? "01";

  return (
    <div className="flex items-center overflow-hidden rounded-md border">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="rounded-none border-0"
        onClick={() =>
          router.push(`${pathname}?month=${year - 1}-${monthPad}&view=year`)
        }
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="px-3 text-sm font-medium">{year}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="rounded-none border-0"
        onClick={() =>
          router.push(`${pathname}?month=${year + 1}-${monthPad}&view=year`)
        }
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

function YearTable({
  yearData,
  selectedMonth,
  currency,
}: {
  yearData: YearMonthSummary[];
  selectedMonth: string;
  currency: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const annualTotalIncome = yearData.reduce((s, r) => s + r.totalIncome, 0);
  const annualTotalExpenses = yearData.reduce((s, r) => s + r.totalExpenses, 0);
  const annualTotalExtraIncome = yearData.reduce(
    (s, r) => s + r.totalExtraIncome,
    0,
  );
  const annualTotalSavings = yearData.reduce((s, r) => s + r.savings, 0);
  const annualTotalCommitments = yearData.reduce(
    (s, r) => s + r.totalCommitments,
    0,
  );
  const annualRemaining = yearData.reduce((s, r) => s + r.remaining, 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Mês</TableHead>
          <TableHead className="text-right">Grupos</TableHead>
          <TableHead className="text-right">Renda extra</TableHead>
          <TableHead className="text-right">Poupança</TableHead>
          <TableHead className="text-right">Disponível</TableHead>
          <TableHead className="text-right">Comprometido</TableHead>
          <TableHead className="text-right">Sobra</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {yearData.map((row) => {
          const committedPct = getPercentage(
            row.totalCommitments,
            row.totalIncome,
          );
          const now = new Date();
          const actualCurrentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
          const isCurrent = row.month === actualCurrentMonth;

          return (
            <TableRow
              key={row.month}
              className="cursor-pointer"
              onClick={() =>
                router.push(`${pathname}?month=${row.month}&view=month`)
              }
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  <span
                    className={
                      isCurrent ? "font-semibold capitalize" : "capitalize"
                    }
                  >
                    {formatMonthShort(row.month)}
                  </span>
                  {isCurrent && (
                    <Badge variant="outline" className="text-xs">
                      Atual
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right">
                {formatMoney(row.totalExpenses, currency)}
              </TableCell>
              <TableCell className="text-right text-emerald-700">
                {row.totalExtraIncome > 0
                  ? formatMoney(row.totalExtraIncome, currency)
                  : "—"}
              </TableCell>
              <TableCell className="text-right text-emerald-700">
                {row.savings > 0 ? formatMoney(row.savings, currency) : "—"}
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatMoney(row.totalIncome, currency)}
              </TableCell>
              <TableCell className="text-right">
                <span
                  className={
                    committedPct > 100 ? "font-medium text-red-700" : ""
                  }
                >
                  {formatPercent(committedPct)}%
                </span>
              </TableCell>
              <TableCell
                className={`text-right font-medium ${row.remaining >= 0 ? "text-emerald-700" : "text-red-700"}`}
              >
                {formatMoney(row.remaining, currency)}
              </TableCell>
            </TableRow>
          );
        })}
        <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
          <TableCell>Total anual</TableCell>
          <TableCell className="text-right">
            {formatMoney(annualTotalExpenses, currency)}
          </TableCell>
          <TableCell className="text-right text-emerald-700">
            {formatMoney(annualTotalExtraIncome, currency)}
          </TableCell>
          <TableCell className="text-right text-emerald-700">
            {formatMoney(annualTotalSavings, currency)}
          </TableCell>
          <TableCell className="text-right">
            {formatMoney(annualTotalIncome, currency)}
          </TableCell>
          <TableCell className="text-right">
            {formatPercent(
              getPercentage(annualTotalCommitments, annualTotalIncome),
            )}
            %
          </TableCell>
          <TableCell
            className={`text-right ${annualRemaining >= 0 ? "text-emerald-700" : "text-red-700"}`}
          >
            {formatMoney(annualRemaining, currency)}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

function MonthSelector({ selectedMonth }: { selectedMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const selectedDate = getDateFromReferenceMonth(selectedMonth);
  const [year, setYear] = useState(selectedDate.getUTCFullYear());

  function goToMonth(month: number) {
    const date = new Date(Date.UTC(year, month, 1));
    router.push(`${pathname}?month=${getReferenceMonthFromDate(date)}`);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="justify-start font-normal capitalize"
        >
          <CalendarIcon />
          {formatReferenceMonth(selectedMonth)}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-3" align="end">
        <div className="flex items-center justify-between mb-3">
          <Button variant="ghost" size="icon" type="button" onClick={() => setYear((y) => y - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-medium">{year}</span>
          <Button variant="ghost" size="icon" type="button" onClick={() => setYear((y) => y + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1">
          {MONTH_LABELS.map((label, i) => {
            const isSelected =
              selectedDate.getUTCFullYear() === year &&
              selectedDate.getUTCMonth() === i;
            return (
              <Button
                key={i}
                type="button"
                variant={isSelected ? "default" : "ghost"}
                size="sm"
                onClick={() => goToMonth(i)}
              >
                {label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
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
            value={selectedMonth}
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

          {group ? (
            <div className="grid gap-1.5 rounded-md border p-3">
              <p className="text-sm font-medium">
                Edicao apenas em {formatReferenceMonth(selectedMonth)}
              </p>
              <p className="text-sm text-muted-foreground">
                A recorrencia do grupo continua, mas os dados salvos aqui ficam
                somente neste mes.
              </p>
            </div>
          ) : (
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="affectsFutureMonths-new"
                checked={affectsFutureMonths}
                onCheckedChange={(checked) =>
                  setAffectsFutureMonths(checked === true)
                }
              />
              <div className="grid gap-1.5">
                <Label htmlFor="affectsFutureMonths-new">
                  Afeta os proximos meses
                </Label>
                <p className="text-sm text-muted-foreground">
                  Quando marcado, este grupo e copiado para os meses seguintes.
                  Cada mes pode ser editado depois com seu proprio valor.
                </p>
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor={`priority-${group?.id ?? "new"}`}>Prioridade</Label>
            <Select name="priority" defaultValue={group?.priority ?? "medium"}>
              <SelectTrigger id={`priority-${group?.id ?? "new"}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">Alta — essencial, nao pode faltar</SelectItem>
                <SelectItem value="medium">Media — importante mas flexivel</SelectItem>
                <SelectItem value="low">Baixa — opcional, cortar se precisar</SelectItem>
              </SelectContent>
            </Select>
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

function SavingsAllocationDialog({
  savingsAllocation,
  selectedMonth,
}: {
  savingsAllocation: SavingsAllocationView | null;
  selectedMonth: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    saveSavingsAllocation,
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
        <Button variant="outline">
          <PiggyBank />
          Poupanca
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Guardar na poupanca</DialogTitle>
          <DialogDescription>
            Separe um valor do planejado para guardar neste mes.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-5">
          <input type="hidden" name="referenceMonth" value={selectedMonth} />

          <div className="grid gap-2">
            <Label htmlFor="savings-amount">Valor para guardar</Label>
            <Input
              id="savings-amount"
              name="amount"
              type="number"
              min="0"
              step="0.01"
              defaultValue={savingsAllocation?.amount ?? "0.00"}
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="savings-description">Descricao</Label>
            <Textarea
              id="savings-description"
              name="description"
              defaultValue={savingsAllocation?.description ?? ""}
              rows={3}
              placeholder="Reserva, objetivo do mes, emergencia..."
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

function DeleteSavingsAllocationButton({
  selectedMonth,
}: {
  selectedMonth: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSavingsAllocation(selectedMonth);

      if (result.status === "success") {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(result.message ?? "Nao foi possivel remover a poupanca.");
    });
  }

  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="Remover poupanca do mes"
      onClick={handleDelete}
      disabled={isPending}
    >
      <Trash2 />
    </Button>
  );
}

type SortField = "name" | "monthlyAmount" | "priority";
type SortDir = "asc" | "desc";

function sortGroups(groups: ExpenseGroupView[], field: SortField, dir: SortDir) {
  return [...groups].sort((a, b) => {
    let cmp = 0;
    if (field === "name") {
      cmp = a.name.localeCompare(b.name, "pt-BR");
    } else if (field === "monthlyAmount") {
      cmp = Number(a.monthlyAmount) - Number(b.monthlyAmount);
    } else {
      cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

export function ExpenseGroupsManager({
  groups,
  extraIncomes,
  savingsAllocation,
  selectedMonth,
  baseIncome,
  currency,
  mode,
  view = "month",
  yearData,
}: ExpenseGroupsManagerProps) {
  const [sortField, setSortField] = useState<SortField>("priority");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showZero, setShowZero] = useState(false);
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
  const savingsAmount = Number(savingsAllocation?.amount ?? 0);
  const totalCommitments = totalExpenses + savingsAmount;
  const remaining = totalIncome - totalCommitments;
  const committedPercentage = getPercentage(totalCommitments, totalIncome);

  if (view === "year" && yearData) {
    const selectedYear = selectedMonth.split("-")[0];
    const annualBase = base * 12;
    const annualTotalExtraIncome = yearData.reduce(
      (s, r) => s + r.totalExtraIncome,
      0,
    );
    const annualTotalIncome = yearData.reduce((s, r) => s + r.totalIncome, 0);
    const annualTotalExpenses = yearData.reduce(
      (s, r) => s + r.totalExpenses,
      0,
    );
    const annualTotalSavings = yearData.reduce((s, r) => s + r.savings, 0);
    const annualTotalCommitments = yearData.reduce(
      (s, r) => s + r.totalCommitments,
      0,
    );
    const annualRemaining = yearData.reduce((s, r) => s + r.remaining, 0);
    const annualCommittedPct = getPercentage(
      annualTotalCommitments,
      annualTotalIncome,
    );

    return (
      <div className="grid gap-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5">
                <CardTitle>Grupos de despesas</CardTitle>
                <CardDescription>
                  Visão anual — {selectedYear}
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <YearSelector selectedMonth={selectedMonth} />
                <ViewToggle view="year" selectedMonth={selectedMonth} />
              </div>
            </CardHeader>
            <CardContent>
              <YearTable
                yearData={yearData}
                selectedMonth={selectedMonth}
                currency={currency}
              />
            </CardContent>
          </Card>

          <div className="grid content-start gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Controle anual</CardTitle>
                <CardDescription>{selectedYear}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      Renda base (×12)
                    </span>
                    <span className="font-medium">
                      {formatMoney(annualBase, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      Renda extra
                    </span>
                    <span className="font-medium text-emerald-700">
                      {formatMoney(annualTotalExtraIncome, currency)}
                    </span>
                  </div>
                </div>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground">
                    Disponível no ano
                  </p>
                  <p className="mt-1 text-2xl font-semibold">
                    {formatMoney(annualTotalIncome, currency)}
                  </p>
                </div>
                <Separator />
                <div className="grid gap-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      Total em grupos
                    </span>
                    <span className="font-medium">
                      {formatMoney(annualTotalExpenses, currency)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">
                      Poupança
                    </span>
                    <span className="font-medium text-emerald-700">
                      {formatMoney(annualTotalSavings, currency)}
                    </span>
                  </div>
                  <Progress value={Math.min(annualCommittedPct, 100)} />
                  <p className="text-sm text-muted-foreground">
                    {formatPercent(annualCommittedPct)}% da renda comprometida.
                  </p>
                </div>
                <Separator />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Sobra</span>
                  <span
                    className={
                      annualRemaining >= 0
                        ? "font-semibold text-emerald-700"
                        : "font-semibold text-red-700"
                    }
                  >
                    {formatMoney(annualRemaining, currency)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
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
                <MonthSelector selectedMonth={selectedMonth} />
                <ViewToggle view="month" selectedMonth={selectedMonth} />
                <ExtraIncomeDialog selectedMonth={selectedMonth} />
                <SavingsAllocationDialog
                  savingsAllocation={savingsAllocation}
                  selectedMonth={selectedMonth}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={showZero ? "Ocultar grupos zerados" : "Mostrar grupos zerados"}
                  onClick={() => setShowZero((v) => !v)}
                >
                  {showZero ? <EyeOff /> : <Eye />}
                </Button>
                <ExpenseGroupDialog selectedMonth={selectedMonth} />
              </div>
            </CardHeader>
            <CardContent>
              {groups.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {(["name", "monthlyAmount"] as const).map((field) => {
                        const labels = { name: "Grupo", monthlyAmount: "Valor no mes" };
                        const active = sortField === field;
                        return (
                          <TableHead key={field}>
                            <button
                              type="button"
                              className="flex items-center gap-1 hover:text-foreground"
                              onClick={() => {
                                if (active) {
                                  setSortDir((d) => (d === "asc" ? "desc" : "asc"));
                                } else {
                                  setSortField(field);
                                  setSortDir("asc");
                                }
                              }}
                            >
                              {labels[field]}
                              <span className="text-xs text-muted-foreground">
                                {active ? (sortDir === "asc" ? "↑" : "↓") : "↕"}
                              </span>
                            </button>
                          </TableHead>
                        );
                      })}
                      <TableHead>Impacto</TableHead>
                      <TableHead className="w-24 text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortGroups(
                      showZero ? groups : groups.filter((g) => Number(g.monthlyAmount) > 0),
                      sortField,
                      sortDir,
                    ).map((group) => {
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
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{group.name}</p>
                                {group.priority === "high" && (
                                  <Badge variant="default" className="text-xs">Alta</Badge>
                                )}
                                {group.priority === "low" && (
                                  <Badge variant="outline" className="text-xs text-muted-foreground">Baixa</Badge>
                                )}
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
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">
                    Poupanca
                  </span>
                  <span className="font-medium text-emerald-700">
                    {formatMoney(savingsAmount, currency)}
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
              <CardTitle>Entradas e poupanca do mes</CardTitle>
              <CardDescription>
                Ajustes mensais que aumentam a renda ou separam dinheiro para
                guardar.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <SavingsAllocationDialog
                savingsAllocation={savingsAllocation}
                selectedMonth={selectedMonth}
              />
              <ExtraIncomeDialog selectedMonth={selectedMonth} />
            </div>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid gap-3 rounded-md border p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <PiggyBank className="mt-0.5 size-4 text-emerald-700" />
                  <div>
                    <p className="font-medium">Poupanca</p>
                    <p className="text-sm text-muted-foreground">
                      {savingsAllocation?.description ||
                        "Valor separado da sobra planejada deste mes."}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-emerald-700">
                    {formatMoney(savingsAmount, currency)}
                  </span>
                  {savingsAllocation ? (
                    <DeleteSavingsAllocationButton selectedMonth={selectedMonth} />
                  ) : null}
                </div>
              </div>
            </div>

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
