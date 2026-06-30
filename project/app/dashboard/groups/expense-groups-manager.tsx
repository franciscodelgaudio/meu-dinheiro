"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  HandCoins,
  Lock,
  Pencil,
  PiggyBank,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";
import { toast } from "sonner";
import {
  createExpenseGroup,
  createPlannedIncome,
  deleteExpenseGroup,
  deletePlannedIncome,
  deleteSavingsAllocation,
  type ExpenseGroupActionState,
  saveSavingsAllocation,
  updateExpenseGroup,
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const initialState: ExpenseGroupActionState = {};

export type ExpenseGroupView = {
  id: string;
  referenceMonth: string;
  name: string;
  monthlyAmount: string;
  affectsFutureMonths: boolean;
  repeatMonths: string | null;
  color: string;
  description: string | null;
  updatedAt: string;
};

export type PlannedIncomeView = {
  id: string;
  referenceMonth: string;
  amount: string;
  affectsFutureMonths: boolean;
  repeatMonths: string | null;
  description: string | null;
  updatedAt: string;
};

export type SavingsAllocationView = {
  id: string;
  referenceMonth: string;
  amount: string;
  affectsFutureMonths: boolean;
  repeatMonths: string | null;
  description: string | null;
  updatedAt: string;
};

export type YearMonthSummary = {
  month: string;
  totalExpenses: number;
  savings: number;
  totalIncome: number;
  totalCommitments: number;
  remaining: number;
};

type ExpenseGroupsManagerProps = {
  groups: ExpenseGroupView[];
  plannedIncomes: PlannedIncomeView[];
  savingsAllocation: SavingsAllocationView | null;
  selectedMonth: string;
  currency: string;
  mode: "planning" | "expenses";
  view?: "month" | "year";
  yearData?: YearMonthSummary[];
  isSelectedMonthClosed?: boolean;
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
  if (!year || !month) return referenceMonth;
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

function formatReferenceMonth(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-").map(Number);
  if (!year || !month) return referenceMonth;
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
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function getPercentage(amount: number, income: number) {
  if (income <= 0) return 0;
  return (amount / income) * 100;
}

const MONTH_LABELS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

function ViewToggle({ view, selectedMonth }: { view: "month" | "year"; selectedMonth: string }) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="flex overflow-hidden rounded-md border">
      <Button
        type="button"
        variant={view === "month" ? "default" : "ghost"}
        size="sm"
        className="rounded-none border-0"
        onClick={() => router.push(`${pathname}?month=${selectedMonth}&view=month`)}
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
        onClick={() => router.push(`${pathname}?month=${year - 1}-${monthPad}&view=year`)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <span className="px-3 text-sm font-medium">{year}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="rounded-none border-0"
        onClick={() => router.push(`${pathname}?month=${year + 1}-${monthPad}&view=year`)}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

function YearTable({ yearData, selectedMonth, currency }: { yearData: YearMonthSummary[]; selectedMonth: string; currency: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const annualTotalIncome = yearData.reduce((s, r) => s + r.totalIncome, 0);
  const annualTotalExpenses = yearData.reduce((s, r) => s + r.totalExpenses, 0);
  const annualTotalSavings = yearData.reduce((s, r) => s + r.savings, 0);
  const annualTotalCommitments = yearData.reduce((s, r) => s + r.totalCommitments, 0);
  const annualRemaining = yearData.reduce((s, r) => s + r.remaining, 0);

  return (
    <div className="overflow-x-auto">
      <Table className="min-w-[480px]">
        <TableHeader>
          <TableRow>
            <TableHead>Mês</TableHead>
            <TableHead className="text-right">Grupos</TableHead>
            <TableHead className="hidden sm:table-cell text-right">Poupança</TableHead>
            <TableHead className="text-right">Renda</TableHead>
            <TableHead className="hidden sm:table-cell text-right">%</TableHead>
            <TableHead className="text-right">Sobra</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {yearData.map((row) => {
            const committedPct = getPercentage(row.totalCommitments, row.totalIncome);
            const now = new Date();
            const actualCurrentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
            const isCurrent = row.month === actualCurrentMonth;

            return (
              <TableRow
                key={row.month}
                className="cursor-pointer"
                onClick={() => router.push(`${pathname}?month=${row.month}&view=month`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className={isCurrent ? "font-semibold capitalize" : "capitalize"}>
                      {formatMonthShort(row.month)}
                    </span>
                    {isCurrent && <Badge variant="outline" className="text-xs">Atual</Badge>}
                  </div>
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {formatMoney(row.totalExpenses, currency)}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-right whitespace-nowrap text-violet-600">
                  {row.savings > 0 ? formatMoney(row.savings, currency) : "—"}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap font-medium">
                  {row.totalIncome > 0 ? formatMoney(row.totalIncome, currency) : "—"}
                </TableCell>
                <TableCell className="hidden sm:table-cell text-right">
                  <span className={committedPct > 100 ? "font-medium text-red-700" : ""}>
                    {formatPercent(committedPct)}%
                  </span>
                </TableCell>
                <TableCell className={`text-right whitespace-nowrap font-medium ${row.remaining >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {formatMoney(row.remaining, currency)}
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
            <TableCell>Total</TableCell>
            <TableCell className="text-right whitespace-nowrap">{formatMoney(annualTotalExpenses, currency)}</TableCell>
            <TableCell className="hidden sm:table-cell text-right whitespace-nowrap text-violet-600">
              {formatMoney(annualTotalSavings, currency)}
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">{formatMoney(annualTotalIncome, currency)}</TableCell>
            <TableCell className="hidden sm:table-cell text-right">
              {formatPercent(getPercentage(annualTotalCommitments, annualTotalIncome))}%
            </TableCell>
            <TableCell className={`text-right whitespace-nowrap ${annualRemaining >= 0 ? "text-emerald-700" : "text-red-700"}`}>
              {formatMoney(annualRemaining, currency)}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
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
        <Button type="button" variant="outline" className="justify-start font-normal capitalize">
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
            const isSelected = selectedDate.getUTCFullYear() === year && selectedDate.getUTCMonth() === i;
            return (
              <Button key={i} type="button" variant={isSelected ? "default" : "ghost"} size="sm" onClick={() => goToMonth(i)}>
                {label}
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

function parseRepeatMonthsToArray(repeatMonths: string | null): number[] {
  if (!repeatMonths) return ALL_MONTHS;
  return repeatMonths.split(",").map(Number);
}

function formatRepeatMonthsLabel(repeatMonths: string | null): string | null {
  if (!repeatMonths) return null;
  const nums = repeatMonths.split(",").map(Number);
  const names = nums.map((n) => MONTH_LABELS[n - 1]);
  if (names.length <= 4) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} +${names.length - 3}`;
}

function MonthRepeatPicker({ selected, onChange }: { selected: number[]; onChange: (v: number[]) => void }) {
  function toggle(num: number) {
    if (selected.includes(num)) {
      if (selected.length === 1) return;
      onChange(selected.filter((m) => m !== num));
    } else {
      onChange([...selected, num].sort((a, b) => a - b));
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Meses ativos</span>
        <div className="flex gap-1">
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => onChange(ALL_MONTHS)}>Todos</button>
          <span className="text-xs text-muted-foreground">·</span>
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => onChange([1, 3, 5, 7, 9, 11])}>Impares</button>
          <span className="text-xs text-muted-foreground">·</span>
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => onChange([2, 4, 6, 8, 10, 12])}>Pares</button>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-1">
        {ALL_MONTHS.map((num) => {
          const active = selected.includes(num);
          return (
            <button
              key={num}
              type="button"
              onClick={() => toggle(num)}
              className={cn("rounded-md border px-2 py-1.5 text-sm transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}
            >
              {MONTH_LABELS[num - 1]}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        {selected.length === 12 ? "Ativo todos os meses." : `Ativo em ${selected.length} de 12 meses.`}
      </p>
    </div>
  );
}

function ExpenseGroupDialog({ group, selectedMonth }: { group?: ExpenseGroupView; selectedMonth: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [affectsFutureMonths, setAffectsFutureMonths] = useState(group?.affectsFutureMonths ?? false);
  const [scope, setScope] = useState<"this-month" | "from-this-month">("this-month");
  const [selectedRepeatMonths, setSelectedRepeatMonths] = useState<number[]>(parseRepeatMonthsToArray(group?.repeatMonths ?? null));
  const action = group ? updateExpenseGroup : createExpenseGroup;
  const [state, formAction, isPending] = useActionState(action, initialState);

  function handleOpenChange(next: boolean) {
    if (next) {
      setScope("this-month");
      setSelectedRepeatMonths(parseRepeatMonthsToArray(group?.repeatMonths ?? null));
    }
    setOpen(next);
  }

  useEffect(() => {
    if (!state.status || !state.message) return;
    if (state.status === "success") {
      toast.success(state.message);
      window.setTimeout(() => { setOpen(false); router.refresh(); }, 0);
      return;
    }
    toast.error(state.message);
  }, [router, state]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {group ? (
          <Button variant="outline" size="icon-sm" aria-label="Editar grupo"><Pencil /></Button>
        ) : (
          <Button><Plus />Novo grupo</Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{group ? "Editar grupo de despesa" : "Novo grupo de despesa"}</DialogTitle>
          <DialogDescription>Registre quanto esse grupo tira da renda do mes selecionado.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-5">
          {group ? <input type="hidden" name="id" value={group.id} /> : null}
          <input type="hidden" name="referenceMonth" value={selectedMonth} />
          <input type="hidden" name="affectsFutureMonths" value={affectsFutureMonths ? "on" : ""} />
          {group && group.affectsFutureMonths ? <input type="hidden" name="scope" value={scope} /> : null}
          {((!group && affectsFutureMonths) || (group && group.affectsFutureMonths && scope === "from-this-month")) &&
            selectedRepeatMonths.map((m) => <input key={m} type="hidden" name="repeatMonth" value={m} />)}

          <div className="grid gap-4 sm:grid-cols-[1fr_150px]">
            <div className="grid gap-2">
              <Label htmlFor={`name-${group?.id ?? "new"}`}>Nome</Label>
              <Input id={`name-${group?.id ?? "new"}`} name="name" defaultValue={group?.name ?? ""} placeholder="Moradia, Alimentacao, Transporte..." required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`color-${group?.id ?? "new"}`}>Cor</Label>
              <Input id={`color-${group?.id ?? "new"}`} name="color" type="color" defaultValue={group?.color ?? "#18181b"} className="h-9 px-2" required />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`monthlyAmount-${group?.id ?? "new"}`}>Valor no mes</Label>
            <Input id={`monthlyAmount-${group?.id ?? "new"}`} name="monthlyAmount" type="number" min="0" step="0.01" defaultValue={group?.monthlyAmount ?? "0.00"} required />
          </div>

          {group ? (
            group.affectsFutureMonths ? (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <button type="button" onClick={() => setScope("this-month")} className={cn("grid gap-1 rounded-md border p-3 text-left transition-colors hover:bg-muted/50", scope === "this-month" && "border-primary bg-muted/30")}>
                    <p className="text-sm font-medium">Apenas em {formatReferenceMonth(selectedMonth)}</p>
                    <p className="text-sm text-muted-foreground">A recorrencia continua, mas os dados ficam so neste mes.</p>
                  </button>
                  <button type="button" onClick={() => setScope("from-this-month")} className={cn("grid gap-1 rounded-md border p-3 text-left transition-colors hover:bg-muted/50", scope === "from-this-month" && "border-primary bg-muted/30")}>
                    <p className="text-sm font-medium">A partir de {formatReferenceMonth(selectedMonth)}</p>
                    <p className="text-sm text-muted-foreground">Atualiza o grupo base e apaga personalizacoes deste mes em diante.</p>
                  </button>
                </div>
                {scope === "from-this-month" && <MonthRepeatPicker selected={selectedRepeatMonths} onChange={setSelectedRepeatMonths} />}
              </div>
            ) : (
              <div className="grid gap-1.5 rounded-md border p-3">
                <p className="text-sm font-medium">Edicao apenas em {formatReferenceMonth(selectedMonth)}</p>
                <p className="text-sm text-muted-foreground">Grupo nao recorrente — os dados ficam somente neste mes.</p>
              </div>
            )
          ) : (
            <div className="grid gap-3">
              <div className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id="affectsFutureMonths-new"
                  checked={affectsFutureMonths}
                  onCheckedChange={(checked) => { setAffectsFutureMonths(checked === true); if (!checked) setSelectedRepeatMonths(ALL_MONTHS); }}
                />
                <div className="grid gap-1.5">
                  <Label htmlFor="affectsFutureMonths-new">Afeta os proximos meses</Label>
                  <p className="text-sm text-muted-foreground">Quando marcado, este grupo e copiado para os meses seguintes. Cada mes pode ser editado depois com seu proprio valor.</p>
                </div>
              </div>
              {affectsFutureMonths && <MonthRepeatPicker selected={selectedRepeatMonths} onChange={setSelectedRepeatMonths} />}
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddIncomeDialog({ selectedMonth }: { selectedMonth: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [affectsFutureMonths, setAffectsFutureMonths] = useState(false);
  const [selectedRepeatMonths, setSelectedRepeatMonths] = useState<number[]>(ALL_MONTHS);
  const [state, formAction, isPending] = useActionState(createPlannedIncome, initialState);

  function handleOpenChange(next: boolean) {
    if (next) {
      setAffectsFutureMonths(false);
      setSelectedRepeatMonths(ALL_MONTHS);
    }
    setOpen(next);
  }

  useEffect(() => {
    if (!state.status || !state.message) return;
    if (state.status === "success") {
      toast.success(state.message);
      window.setTimeout(() => { setOpen(false); router.refresh(); }, 0);
      return;
    }
    toast.error(state.message);
  }, [router, state]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline"><Plus />Adicionar renda</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Adicionar renda</DialogTitle>
          <DialogDescription>Registre uma fonte de renda para {formatReferenceMonth(selectedMonth)}.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-5">
          <input type="hidden" name="referenceMonth" value={selectedMonth} />
          <input type="hidden" name="affectsFutureMonths" value={affectsFutureMonths ? "on" : ""} />
          {affectsFutureMonths && selectedRepeatMonths.map((m) => <input key={m} type="hidden" name="repeatMonth" value={m} />)}

          <div className="grid gap-2">
            <Label htmlFor="planned-income-description">Descricao</Label>
            <Input id="planned-income-description" name="description" placeholder="Salario, freela, bonus..." />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="planned-income-amount">Valor</Label>
            <Input id="planned-income-amount" name="amount" type="number" min="0" step="0.01" defaultValue="0.00" required />
          </div>

          <div className="grid gap-3">
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="planned-income-affectsFutureMonths"
                checked={affectsFutureMonths}
                onCheckedChange={(checked) => { setAffectsFutureMonths(checked === true); if (!checked) setSelectedRepeatMonths(ALL_MONTHS); }}
              />
              <div className="grid gap-1.5">
                <Label htmlFor="planned-income-affectsFutureMonths">Repetir nos proximos meses</Label>
                <p className="text-sm text-muted-foreground">Quando marcado, esta renda e aplicada nos meses seguintes conforme os meses selecionados.</p>
              </div>
            </div>
            {affectsFutureMonths && <MonthRepeatPicker selected={selectedRepeatMonths} onChange={setSelectedRepeatMonths} />}
          </div>

          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Adicionar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SavingsAllocationDialog({ savingsAllocation, selectedMonth }: { savingsAllocation: SavingsAllocationView | null; selectedMonth: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [affectsFutureMonths, setAffectsFutureMonths] = useState(savingsAllocation?.affectsFutureMonths ?? false);
  const [selectedRepeatMonths, setSelectedRepeatMonths] = useState<number[]>(parseRepeatMonthsToArray(savingsAllocation?.repeatMonths ?? null));
  const [state, formAction, isPending] = useActionState(saveSavingsAllocation, initialState);

  function handleOpenChange(next: boolean) {
    if (next) {
      setAffectsFutureMonths(savingsAllocation?.affectsFutureMonths ?? false);
      setSelectedRepeatMonths(parseRepeatMonthsToArray(savingsAllocation?.repeatMonths ?? null));
    }
    setOpen(next);
  }

  useEffect(() => {
    if (!state.status || !state.message) return;
    if (state.status === "success") {
      toast.success(state.message);
      window.setTimeout(() => { setOpen(false); router.refresh(); }, 0);
      return;
    }
    toast.error(state.message);
  }, [router, state]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline"><PiggyBank />Poupanca</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Guardar na poupanca</DialogTitle>
          <DialogDescription>Separe um valor do planejado para guardar neste mes.</DialogDescription>
        </DialogHeader>
        <form action={formAction} className="grid gap-5">
          <input type="hidden" name="referenceMonth" value={selectedMonth} />
          <input type="hidden" name="affectsFutureMonths" value={affectsFutureMonths ? "on" : ""} />
          {affectsFutureMonths && selectedRepeatMonths.map((m) => <input key={m} type="hidden" name="repeatMonth" value={m} />)}

          <div className="grid gap-2">
            <Label htmlFor="savings-amount">Valor para guardar</Label>
            <Input id="savings-amount" name="amount" type="number" min="0" step="0.01" defaultValue={savingsAllocation?.amount ?? "0.00"} required />
          </div>

          <div className="grid gap-3">
            <div className="flex items-start gap-3 rounded-md border p-3">
              <Checkbox
                id="savings-affectsFutureMonths"
                checked={affectsFutureMonths}
                onCheckedChange={(checked) => { setAffectsFutureMonths(checked === true); if (!checked) setSelectedRepeatMonths(ALL_MONTHS); }}
              />
              <div className="grid gap-1.5">
                <Label htmlFor="savings-affectsFutureMonths">Repetir nos proximos meses</Label>
                <p className="text-sm text-muted-foreground">Quando marcado, esta poupanca e aplicada nos meses seguintes conforme os meses selecionados.</p>
              </div>
            </div>
            {affectsFutureMonths && <MonthRepeatPicker selected={selectedRepeatMonths} onChange={setSelectedRepeatMonths} />}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="savings-description">Descricao</Label>
            <Textarea id="savings-description" name="description" defaultValue={savingsAllocation?.description ?? ""} rows={3} placeholder="Reserva, objetivo do mes, emergencia..." />
          </div>

          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteExpenseGroupButton({ group }: { group: ExpenseGroupView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpenseGroup(group.id);
      if (result.status === "success") { toast.success(result.message); router.refresh(); setOpen(false); return; }
      toast.error(result.message ?? "Nao foi possivel remover o grupo.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="destructive" size="icon-sm" aria-label="Excluir grupo"><Trash2 /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir grupo?</DialogTitle>
          <DialogDescription>Esta acao nao pode ser desfeita.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeletePlannedIncomeButton({ incomeId }: { incomeId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deletePlannedIncome(incomeId);
      if (result.status === "success") { toast.success(result.message); router.refresh(); setOpen(false); return; }
      toast.error(result.message ?? "Nao foi possivel remover a renda planejada.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="icon-sm" aria-label="Remover renda planejada"><Trash2 /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover renda planejada?</DialogTitle>
          <DialogDescription>Esta acao nao pode ser desfeita.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Removendo..." : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteSavingsAllocationButton({ savingsId }: { savingsId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteSavingsAllocation(savingsId);
      if (result.status === "success") { toast.success(result.message); router.refresh(); setOpen(false); return; }
      toast.error(result.message ?? "Nao foi possivel remover a poupanca.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline" size="icon-sm" aria-label="Remover poupanca"><Trash2 /></Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remover poupanca?</DialogTitle>
          <DialogDescription>Esta acao nao pode ser desfeita.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild><Button type="button" variant="outline">Cancelar</Button></DialogClose>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending ? "Removendo..." : "Remover"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type SortField = "name" | "monthlyAmount";
type SortDir = "asc" | "desc";

function sortGroups(groups: ExpenseGroupView[], field: SortField, dir: SortDir) {
  return [...groups].sort((a, b) => {
    let cmp = 0;
    if (field === "name") cmp = a.name.localeCompare(b.name, "pt-BR");
    else if (field === "monthlyAmount") cmp = Number(a.monthlyAmount) - Number(b.monthlyAmount);
    return dir === "asc" ? cmp : -cmp;
  });
}

export function ExpenseGroupsManager({
  groups,
  plannedIncomes,
  savingsAllocation,
  selectedMonth,
  currency,
  mode,
  view = "month",
  yearData,
  isSelectedMonthClosed = false,
}: ExpenseGroupsManagerProps) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [showZero, setShowZero] = useState(false);

  const totalIncome = plannedIncomes.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalExpenses = groups.reduce((total, group) => total + Number(group.monthlyAmount), 0);
  const savingsAmount = Number(savingsAllocation?.amount ?? 0);
  const totalCommitments = totalExpenses + savingsAmount;
  const remaining = totalIncome - totalCommitments;
  const committedPercentage = getPercentage(totalCommitments, totalIncome);

  if (view === "year" && yearData) {
    const selectedYear = selectedMonth.split("-")[0];
    const annualTotalIncome = yearData.reduce((s, r) => s + r.totalIncome, 0);
    const annualTotalExpenses = yearData.reduce((s, r) => s + r.totalExpenses, 0);
    const annualTotalSavings = yearData.reduce((s, r) => s + r.savings, 0);
    const annualTotalCommitments = yearData.reduce((s, r) => s + r.totalCommitments, 0);
    const annualRemaining = yearData.reduce((s, r) => s + r.remaining, 0);
    const annualCommittedPct = getPercentage(annualTotalCommitments, annualTotalIncome);

    return (
      <div className="grid gap-4 sm:gap-6">
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="border-zinc-200 shadow-sm">
            <CardHeader className="gap-3 pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <CardTitle className="text-base font-semibold text-zinc-950">Grupos de despesas</CardTitle>
                  <CardDescription>Visão anual — {selectedYear}</CardDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 border-t border-zinc-100 pt-3">
                <YearSelector selectedMonth={selectedMonth} />
                <ViewToggle view="year" selectedMonth={selectedMonth} />
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              <YearTable yearData={yearData} selectedMonth={selectedMonth} currency={currency} />
            </CardContent>
          </Card>

          <div className="grid content-start gap-4">
            <Card className="border-zinc-200 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-zinc-800">Controle anual</CardTitle>
                <CardDescription>{selectedYear}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-zinc-500">Renda planejada</span>
                  <span className="text-sm font-semibold text-zinc-950">
                    {formatMoney(annualTotalIncome, currency)}
                  </span>
                </div>

                <Separator className="bg-zinc-100" />

                <div>
                  <p className="text-xs text-zinc-500">Disponível no ano</p>
                  <p className="mt-0.5 text-2xl font-bold text-zinc-950">{formatMoney(annualTotalIncome, currency)}</p>
                </div>

                <Separator className="bg-zinc-100" />

                <div className="grid gap-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-zinc-500">Total em grupos</span>
                    <span className="text-sm font-semibold text-zinc-950">{formatMoney(annualTotalExpenses, currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-zinc-500">Poupança</span>
                    <span className={`text-sm font-semibold ${annualTotalSavings > 0 ? "text-violet-600" : "text-zinc-400"}`}>
                      {formatMoney(annualTotalSavings, currency)}
                    </span>
                  </div>
                  <Progress value={Math.min(annualCommittedPct, 100)} className="h-1.5" />
                  <p className="text-xs text-zinc-400">{formatPercent(annualCommittedPct)}% da renda comprometida</p>
                </div>

                <Separator className="bg-zinc-100" />

                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-zinc-500">Sobra</span>
                  <span className={`text-sm font-bold ${annualRemaining >= 0 ? "text-emerald-700" : "text-red-600"}`}>
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
    <div className="grid gap-4 sm:gap-6">
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_320px]">
        {mode === "expenses" ? (
          <Card className="border-zinc-200 shadow-sm">
            <CardHeader className="gap-0 pb-0">
              <div className="flex items-start justify-between gap-3 pb-3">
                <div className="space-y-0.5">
                  <CardTitle className="text-base font-semibold text-zinc-950">Grupos de despesas</CardTitle>
                  <CardDescription className="capitalize">{formatReferenceMonth(selectedMonth)}</CardDescription>
                </div>
                <ExpenseGroupDialog selectedMonth={selectedMonth} />
              </div>
              <div className="flex items-center gap-2 border-t border-zinc-100 pt-3">
                <MonthSelector selectedMonth={selectedMonth} />
                <ViewToggle view="month" selectedMonth={selectedMonth} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={showZero ? "Ocultar grupos zerados" : "Mostrar grupos zerados"}
                  onClick={() => setShowZero((v) => !v)}
                  className="text-zinc-400 hover:text-zinc-700"
                >
                  {showZero ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              {isSelectedMonthClosed && (
                <div className="flex items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-500">
                  <Lock className="size-3.5 shrink-0" />
                  <span>Mês fechado — valores exibidos são os gastos reais do período. Grupos com despesas não podem ser removidos.</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              {groups.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="pl-4 sm:pl-4">
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => { if (sortField === "name") setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortField("name"); setSortDir("asc"); } }}
                        >
                          Grupo
                          <span className="text-xs text-muted-foreground">{sortField === "name" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
                        </button>
                      </TableHead>
                      <TableHead className="hidden sm:table-cell">
                        <button
                          type="button"
                          className="flex items-center gap-1 hover:text-foreground"
                          onClick={() => { if (sortField === "monthlyAmount") setSortDir((d) => (d === "asc" ? "desc" : "asc")); else { setSortField("monthlyAmount"); setSortDir("asc"); } }}
                        >
                          Valor no mês
                          <span className="text-xs text-muted-foreground">{sortField === "monthlyAmount" ? (sortDir === "asc" ? "↑" : "↓") : "↕"}</span>
                        </button>
                      </TableHead>
                      <TableHead className="w-20 pr-4 text-right sm:w-24 sm:pr-4">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortGroups(showZero ? groups : groups.filter((g) => Number(g.monthlyAmount) > 0), sortField, sortDir).map((group) => (
                      <TableRow key={group.id}>
                        <TableCell className="pl-4 sm:pl-4">
                          <div className="flex items-center gap-3">
                            <span className="size-3 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                            <div className="grid gap-0.5">
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{group.name}</p>
                              </div>
                              <p className="text-sm font-medium text-zinc-700 sm:hidden">{formatMoney(group.monthlyAmount, currency)}</p>
                              {group.repeatMonths && <p className="text-xs text-muted-foreground">{formatRepeatMonthsLabel(group.repeatMonths)}</p>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden font-medium sm:table-cell">{formatMoney(group.monthlyAmount, currency)}</TableCell>
                        <TableCell className="pr-4 sm:pr-4">
                          <div className="flex justify-end gap-2">
                            <ExpenseGroupDialog group={group} selectedMonth={selectedMonth} />
                            <DeleteExpenseGroupButton group={group} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="flex min-h-56 flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400">
                    <WalletCards className="size-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-800">Nenhum grupo neste mês</p>
                    <p className="mt-1 max-w-sm text-sm text-zinc-400">Crie grupos para simular o impacto de cada despesa na sua renda.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}

        <div className="grid content-start gap-4">
          <Card className="border-zinc-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-zinc-800">Controle mensal</CardTitle>
              <CardDescription className="capitalize">{formatReferenceMonth(selectedMonth)}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-zinc-500">Renda planejada</span>
                  <span className={`text-sm font-semibold ${totalIncome > 0 ? "text-zinc-950" : "text-zinc-400"}`}>
                    {formatMoney(totalIncome, currency)}
                  </span>
                </div>
              </div>

              <Separator className="bg-zinc-100" />

              <div>
                <p className="text-xs text-zinc-500">Disponível no mês</p>
                <p className="mt-0.5 text-2xl font-bold text-zinc-950">{formatMoney(totalIncome, currency)}</p>
              </div>

              <Separator className="bg-zinc-100" />

              <div className="grid gap-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-zinc-500">Total em grupos</span>
                  <span className="text-sm font-semibold text-zinc-950">{formatMoney(totalExpenses, currency)}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-zinc-500">Poupança</span>
                  <span className={`text-sm font-semibold ${savingsAmount > 0 ? "text-violet-600" : "text-zinc-400"}`}>
                    {formatMoney(savingsAmount, currency)}
                  </span>
                </div>
                <Progress value={Math.min(committedPercentage, 100)} className="h-1.5" />
                <p className="text-xs text-zinc-400">{formatPercent(committedPercentage)}% da renda comprometida</p>
              </div>

              <Separator className="bg-zinc-100" />

              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-zinc-500">Sobra</span>
                <span className={`text-sm font-bold ${remaining >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                  {formatMoney(remaining, currency)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1.5">
            <CardTitle>Renda e poupanca do mes</CardTitle>
            <CardDescription>Adicione fontes de renda e separe dinheiro para guardar.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <AddIncomeDialog selectedMonth={selectedMonth} />
            <SavingsAllocationDialog savingsAllocation={savingsAllocation} selectedMonth={selectedMonth} />
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2 rounded-md border p-4">
            {plannedIncomes.length === 0 ? (
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <HandCoins className="size-4 shrink-0" />
                <span>Nenhuma renda adicionada para este mes.</span>
              </div>
            ) : (
              <>
                {plannedIncomes.map((income) => (
                  <div key={income.id} className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <HandCoins className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                      <div>
                        <p className="font-medium">{income.description || "Renda planejada"}</p>
                        {income.repeatMonths && (
                          <p className="mt-0.5 text-xs text-muted-foreground">{formatRepeatMonthsLabel(income.repeatMonths)}</p>
                        )}
                        {income.affectsFutureMonths &&
                          !income.repeatMonths &&
                          income.referenceMonth !== selectedMonth && (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              Recorrente desde {formatReferenceMonth(income.referenceMonth)}
                            </p>
                          )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-emerald-700">{formatMoney(income.amount, currency)}</span>
                      <DeletePlannedIncomeButton incomeId={income.id} />
                    </div>
                  </div>
                ))}
                {plannedIncomes.length > 1 && (
                  <div className="flex items-center justify-between border-t pt-2">
                    <span className="text-sm font-medium text-zinc-700">Total</span>
                    <span className="font-semibold text-emerald-700">{formatMoney(totalIncome, currency)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid gap-3 rounded-md border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <PiggyBank className="mt-0.5 size-4 text-violet-700" />
                <div>
                  <p className="font-medium">Poupanca</p>
                  <p className="text-sm text-muted-foreground">
                    {savingsAllocation?.description || "Valor separado da sobra planejada deste mes."}
                  </p>
                  {savingsAllocation?.repeatMonths && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatRepeatMonthsLabel(savingsAllocation.repeatMonths)}</p>
                  )}
                  {savingsAllocation?.affectsFutureMonths &&
                    !savingsAllocation.repeatMonths &&
                    savingsAllocation.referenceMonth !== selectedMonth && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Recorrente desde {formatReferenceMonth(savingsAllocation.referenceMonth)}
                      </p>
                    )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${savingsAmount > 0 ? "text-violet-700" : "text-zinc-400"}`}>
                  {formatMoney(savingsAmount, currency)}
                </span>
                {savingsAllocation ? <DeleteSavingsAllocationButton savingsId={savingsAllocation.id} /> : null}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
