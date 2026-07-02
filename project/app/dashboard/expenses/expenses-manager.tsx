"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarIcon,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ImagePlus,
  CreditCard,
  MoreHorizontal,
  Pencil,
  Plus,
  ReceiptText,
  Send,
  Sparkles,
  Wand2,
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
import { CurrencyInput } from "@/components/ui/currency-input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const initialState: ExpenseActionState = {};
const initialQuickState: QuickExpenseActionState = {};

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

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
  expenseGroupId: string;
  groupName: string;
  groupColor: string;
  creditCardPurchaseId?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
};

export type CommonExpenseTemplate = {
  title: string;
  amount: string;
  expenseGroupId: string;
  count: number;
};

type ExpensesManagerProps = {
  groups: ExpenseGroupOption[];
  groupTotals: ExpenseGroupTotal[];
  expenses: ExpenseView[];
  commonExpenses: CommonExpenseTemplate[];
  selectedMonth: string;
  isCurrentPeriod: boolean;
  currency: string;
  totalExpenses: number;
  currentPage: number;
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

function shiftReferenceMonth(referenceMonth: string, delta: number) {
  const [year, month] = referenceMonth.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatDayLabel(day: string) {
  const [year, month, date] = day.split("-").map(Number);

  return new Intl.DateTimeFormat("pt-BR", {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, date)));
}

function formatWeekdayShort(day: string) {
  const [year, month, date] = day.split("-").map(Number);

  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    timeZone: "UTC",
  })
    .format(new Date(Date.UTC(year, month - 1, date)))
    .replace(".", "");
}

function groupExpensesByDate(expenses: ExpenseView[]) {
  const order: string[] = [];
  const byDay = new Map<string, ExpenseView[]>();

  for (const expense of expenses) {
    const day = formatDateInput(expense.spentAt);

    if (!byDay.has(day)) {
      order.push(day);
      byDay.set(day, []);
    }

    byDay.get(day)!.push(expense);
  }

  return order.map((day) => {
    const items = byDay.get(day)!;
    return { day, items, total: items.reduce((sum, e) => sum + Number(e.amount), 0) };
  });
}

function getDefaultSpentAt(selectedMonth: string, isCurrentPeriod: boolean) {
  if (isCurrentPeriod) {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
      today.getDate(),
    ).padStart(2, "0")}`;
  }

  return `${selectedMonth}-01`;
}

/** Faixas de uso do orçamento: 100% de conta fixa é neutro, não alerta. */
function getBudgetUsageState(usedPct: number) {
  if (usedPct > 100) {
    return {
      label: "Estourou",
      textClass: "text-red-600",
      pillClass: "bg-red-50 text-red-700",
      barClass: "bg-red-500",
    };
  }

  if (usedPct === 100) {
    return {
      label: "No limite",
      textClass: "text-zinc-500",
      pillClass: "bg-zinc-100 text-zinc-600",
      barClass: "bg-zinc-400",
    };
  }

  if (usedPct >= 80) {
    return {
      label: "Atenção",
      textClass: "text-amber-600",
      pillClass: "bg-amber-50 text-amber-700",
      barClass: "bg-amber-500",
    };
  }

  return {
    label: "Com folga",
    textClass: "text-emerald-600",
    pillClass: "bg-emerald-50 text-emerald-700",
    barClass: "bg-emerald-500",
  };
}

/** Variante "só a sobra": importa apenas se o grupo excedeu, zerou ou ainda tem folga. */
function getGroupRestState(remaining: number) {
  if (remaining < 0) {
    return { label: "excedeu", valueClass: "text-red-600" };
  }

  if (remaining === 0) {
    return { label: "tudo usado", valueClass: "text-zinc-400" };
  }

  return { label: "restante", valueClass: "text-emerald-700" };
}

function MonthControl({
  selectedMonth,
  className,
}: {
  selectedMonth: string;
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [year, month] = selectedMonth.split("-").map(Number);
  const [viewYear, setViewYear] = useState(year);

  useEffect(() => setViewYear(year), [year]);

  function goToMonth(value: string) {
    router.push(`${pathname}?month=${value}`);
  }

  function selectMonth(m: number) {
    goToMonth(`${viewYear}-${String(m).padStart(2, "0")}`);
    setOpen(false);
  }

  return (
    <div className={cn("flex items-center gap-1 rounded-xl border bg-background p-1", className)}>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Mês anterior"
        onClick={() => goToMonth(shiftReferenceMonth(selectedMonth, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-w-0 flex-1 justify-center gap-2 font-semibold capitalize sm:flex-none"
          >
            <CalendarIcon className="size-3.5 shrink-0 text-zinc-400" />
            <span className="truncate">{formatReferenceMonth(selectedMonth)}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="center">
          <div className="mb-3 flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="icon" onClick={() => setViewYear((y) => y - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-sm font-medium">{viewYear}</span>
            <Button type="button" variant="ghost" size="icon" onClick={() => setViewYear((y) => y + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((name, i) => {
              const m = i + 1;
              const isSelected = m === month && viewYear === year;
              return (
                <Button key={m} type="button" variant={isSelected ? "default" : "ghost"} size="sm" onClick={() => selectMonth(m)}>
                  {name}
                </Button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label="Próximo mês"
        onClick={() => goToMonth(shiftReferenceMonth(selectedMonth, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}

function ExpenseKpis({
  totalSpent,
  totalPlanned,
  currency,
}: {
  totalSpent: number;
  totalPlanned: number;
  currency: string;
}) {
  const remaining = totalPlanned - totalSpent;
  const isOver = remaining < 0;
  const usedPct = totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0;
  const usageState = getBudgetUsageState(usedPct);

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Card className="gap-1 py-4">
        <CardContent className="px-4">
          <p className="text-xs font-semibold text-zinc-500">Gasto registrado</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
            {formatMoney(totalSpent, currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">{usedPct}% do planejado</p>
        </CardContent>
      </Card>
      <Card className="gap-1 py-4">
        <CardContent className="px-4">
          <p className="text-xs font-semibold text-zinc-500">Planejado</p>
          <p className="mt-2 text-xl font-semibold tracking-tight text-zinc-950 sm:text-2xl">
            {formatMoney(totalPlanned, currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">orçamento do mês</p>
        </CardContent>
      </Card>
      <Card className={cn("gap-1 py-4", isOver ? "border-red-200 bg-red-50" : "border-emerald-200 bg-emerald-50")}>
        <CardContent className="px-4">
          <p className="text-xs font-semibold text-zinc-500">{isOver ? "Excedente" : "Sobra"}</p>
          <p
            className={cn(
              "mt-2 text-xl font-semibold tracking-tight sm:text-2xl",
              isOver ? "text-red-700" : "text-emerald-700",
            )}
          >
            {formatMoney(remaining, currency)}
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            {isOver ? "acima do planejado este mês" : "disponível até o fim do mês"}
          </p>
        </CardContent>
      </Card>
      <Card className="gap-1 py-4">
        <CardContent className="px-4">
          <p className="text-xs font-semibold text-zinc-500">Uso do orçamento</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={cn("text-xl font-bold tracking-tight sm:text-2xl", usageState.textClass)}>
              {usedPct}%
            </span>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", usageState.pillClass)}>
              {usageState.label}
            </span>
          </div>
          <div className="mt-2.5 h-[7px] w-full overflow-hidden rounded-full bg-zinc-100">
            <div
              className={cn("h-full rounded-full transition-all", usageState.barClass)}
              style={{ width: `${Math.min(usedPct, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function GroupUsageCard({
  groupTotals,
  currency,
  selectedMonth,
  className,
}: {
  groupTotals: ExpenseGroupTotal[];
  currency: string;
  selectedMonth: string;
  className?: string;
}) {
  return (
    <Card className={cn("h-fit", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold text-zinc-800">Uso por grupo</CardTitle>
        <CardDescription className="capitalize">{formatReferenceMonth(selectedMonth)}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {groupTotals.map((group) => {
          const spent = Number(group.spentAmount);
          const planned = Number(group.monthlyAmount);
          const remaining = planned - spent;
          const restState = getGroupRestState(remaining);

          return (
            <div
              key={group.id}
              className="flex items-center justify-between gap-3 border-b border-zinc-100 py-2.5 last:border-0"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                <span className="truncate text-sm font-medium text-zinc-700">{group.name}</span>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn("font-mono text-sm font-semibold", restState.valueClass)}>
                  {formatMoney(remaining, currency)}
                </p>
                <p className="text-[11px] text-zinc-400">{restState.label}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
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
  const [mobileOpen, setMobileOpen] = useState(true);
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
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
        setSelectedImages([]);
        setPreviewOpen(true);
      }, 0);
      toast.success(state.message);
      return;
    }

    toast.error(state.message);
  }, [state]);

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
      <Card className="gap-3 py-4 sm:py-6">
        <CardHeader className="gap-1 pb-0">
          <button
            type="button"
            className="flex w-full items-center gap-2 text-left md:pointer-events-none"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((o) => !o)}
          >
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4" />
              Captura rápida
            </CardTitle>
            <ChevronDown
              className={cn(
                "ml-auto size-4 shrink-0 text-zinc-400 transition-transform md:hidden",
                mobileOpen && "rotate-180",
              )}
            />
          </button>
          <CardDescription>
            Digite como voce falaria ou envie um print/nota. Voce confirma antes de salvar.
          </CardDescription>
        </CardHeader>
        <CardContent className={cn(!mobileOpen && "hidden md:block")}>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.delete("quickImage");
              for (const file of selectedImages) {
                fd.append("quickImage", file);
              }
              startTransition(() => analyzeAction(fd));
            }}
          >
            <input type="hidden" name="selectedMonth" value={selectedMonth} />
            <Textarea
              name="quickText"
              rows={2}
              placeholder="gastei 42 no bk hoje; mercado 280 reais pra semana; uber 23"
              className="min-h-20 resize-none"
            />
            <div className="flex flex-col gap-2">
              {selectedImages.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {selectedImages.map((file, idx) => (
                    <span
                      key={idx}
                      className="flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                    >
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <button
                        type="button"
                        aria-label={`Remover ${file.name}`}
                        className="ml-0.5 text-emerald-500 hover:text-emerald-800"
                        onClick={() => {
                          const next = selectedImages.filter((_, i) => i !== idx);
                          setSelectedImages(next);
                          if (next.length === 0 && imageInputRef.current) {
                            imageInputRef.current.value = "";
                          }
                        }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex items-center justify-end gap-2">
                  <Label className="flex cursor-pointer items-center justify-center rounded-md border p-2 transition-colors hover:bg-zinc-50" title="Adicionar imagem">
                    <ImagePlus className="size-4" />
                    <Input
                      ref={imageInputRef}
                      name="quickImage"
                      type="file"
                      accept="image/*"
                      multiple
                      className="absolute opacity-0 w-px h-px overflow-hidden"
                      onChange={(e) => {
                        const newFiles = Array.from(e.target.files ?? []);
                        if (newFiles.length > 0) {
                          setSelectedImages((prev) => [...prev, ...newFiles]);
                          e.target.value = "";
                        }
                      }}
                    />
                  </Label>
                  <Label className="flex cursor-pointer items-center justify-center rounded-md border p-2 transition-colors hover:bg-zinc-50" title="Tirar foto">
                    <Camera className="size-4" />
                    <Input
                      ref={cameraInputRef}
                      name="quickImage"
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="absolute opacity-0 w-px h-px overflow-hidden"
                      onChange={(e) => {
                        const newFiles = Array.from(e.target.files ?? []);
                        if (newFiles.length > 0) {
                          setSelectedImages((prev) => [...prev, ...newFiles]);
                          e.target.value = "";
                        }
                      }}
                    />
                  </Label>
                </div>
                <Button type="submit" className="sm:w-auto" disabled={isAnalyzing || groups.length === 0}>
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
                        <CurrencyInput
                          id={`quick-amount-${index}`}
                          name={`items.${index}.amount`}
                          defaultValue={item.amount}
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
  commonExpenses,
  currency,
  selectedMonth,
  isCurrentPeriod = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  trigger,
}: {
  expense?: ExpenseView;
  groups: ExpenseGroupOption[];
  commonExpenses?: CommonExpenseTemplate[];
  currency: string;
  selectedMonth: string;
  isCurrentPeriod?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const isControlled = controlledOpen !== undefined;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = isControlled ? controlledOpen! : uncontrolledOpen;
  const setOpen = isControlled ? controlledOnOpenChange! : setUncontrolledOpen;
  const defaultSpentAt = expense
    ? formatDateInput(expense.spentAt)
    : getDefaultSpentAt(selectedMonth, isCurrentPeriod);
  const [selectedGroupId, setSelectedGroupId] = useState(
    expense?.expenseGroupId ?? groups[0]?.id ?? "",
  );
  const [groupComboboxOpen, setGroupComboboxOpen] = useState(false);
  const [spentAt, setSpentAt] = useState(defaultSpentAt);
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense?.amount ?? "");
  const action = expense ? updateExpense : createExpense;
  const [state, formAction, isPending] = useActionState(action, initialState);
  const groupById = useMemo(
    () => new Map(groups.map((group) => [group.id, group])),
    [groups],
  );

  const sortedGroups = useMemo(() => {
    const usageCount = new Map<string, number>();
    for (const t of commonExpenses ?? []) {
      usageCount.set(t.expenseGroupId, (usageCount.get(t.expenseGroupId) ?? 0) + t.count);
    }
    return [...groups].sort((a, b) => (usageCount.get(b.id) ?? 0) - (usageCount.get(a.id) ?? 0));
  }, [groups, commonExpenses]);

  function applyTemplate(template: CommonExpenseTemplate) {
    setTitle(template.title);
    setAmount(template.amount);
    setSelectedGroupId(template.expenseGroupId);
  }

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
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger ??
            (expense ? (
              <Button variant="outline" size="icon-sm" aria-label="Editar gasto">
                <Pencil />
              </Button>
            ) : (
              <Button size="icon" disabled={groups.length === 0} aria-label="Novo gasto">
                <Plus />
              </Button>
            ))}
        </DialogTrigger>
      )}
      <DialogContent className="flex flex-col sm:max-w-xl max-h-[90dvh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar gasto" : "Novo gasto"}</DialogTitle>
          <DialogDescription>
            Informe data, descricao, grupo de despesas e quanto foi gasto.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-5 flex-1 min-h-0">
          {expense ? <input type="hidden" name="id" value={expense.id} /> : null}
          <input type="hidden" name="expenseGroupId" value={selectedGroupId} />

          <div className="flex flex-col gap-5 overflow-y-auto flex-1">
          {!expense && commonExpenses && commonExpenses.length > 0 ? (
            <div className="grid gap-2 rounded-md border bg-muted/30 p-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Wand2 className="size-4 text-emerald-600" />
                Entradas comuns
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                {commonExpenses.map((template) => {
                  const group = groupById.get(template.expenseGroupId);

                  return (
                    <button
                      key={`${template.title}-${template.expenseGroupId}`}
                      type="button"
                      onClick={() => applyTemplate(template)}
                      className="grid min-h-20 gap-1 rounded-md border bg-background p-3 text-left text-sm transition hover:border-emerald-300 hover:bg-emerald-50/60"
                    >
                      <span className="truncate font-medium">{template.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {group?.name ?? "Grupo"}
                      </span>
                      <span className="text-xs font-medium text-emerald-700">
                        {formatMoney(template.amount, currency)} · {template.count}x
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="grid gap-2">
              <Label htmlFor={`spentAt-${expense?.id ?? "new"}`}>Data</Label>
              <Input
                id={`spentAt-${expense?.id ?? "new"}`}
                name="spentAt"
                type="date"
                value={spentAt}
                onChange={(event) => setSpentAt(event.target.value)}
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
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Mercado, aluguel, aplicativo..."
                required
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
            <div className="grid gap-2">
              <Label>Grupo de despesas</Label>
              <Popover open={groupComboboxOpen} onOpenChange={setGroupComboboxOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={groupComboboxOpen}
                    className="w-full justify-between font-normal"
                  >
                    {selectedGroupId ? (
                      <span className="flex items-center gap-2 truncate">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: groupById.get(selectedGroupId)?.color }}
                        />
                        {groupById.get(selectedGroupId)?.name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Escolha um grupo</span>
                    )}
                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Pesquisar grupo..." />
                    <CommandList>
                      <CommandEmpty>Nenhum grupo encontrado.</CommandEmpty>
                      <CommandGroup>
                        {sortedGroups.map((group) => (
                          <CommandItem
                            key={group.id}
                            value={group.name}
                            onSelect={() => {
                              setSelectedGroupId(group.id);
                              setGroupComboboxOpen(false);
                            }}
                          >
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{ backgroundColor: group.color }}
                            />
                            {group.name}
                            <Check
                              className={cn(
                                "ml-auto size-4",
                                selectedGroupId === group.id ? "opacity-100" : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`amount-${expense?.id ?? "new"}`}>Valor</Label>
              <CurrencyInput
                id={`amount-${expense?.id ?? "new"}`}
                name="amount"
                value={amount}
                onChange={setAmount}
                required
              />
            </div>
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

function CreditCardExpenseDialog({
  selectedMonth,
  isCurrentPeriod,
}: {
  selectedMonth: string;
  isCurrentPeriod: boolean;
}) {
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
        <Button variant="outline" size="icon" aria-label="Compra parcelada">
          <CreditCard className="size-4" />
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
                defaultValue={getDefaultSpentAt(selectedMonth, isCurrentPeriod)}
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
              <CurrencyInput
                id="card-totalAmount"
                name="totalAmount"
                defaultValue="0"
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

function DeleteExpenseDialog({
  expense,
  open,
  onOpenChange,
}: {
  expense: ExpenseView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpense(expense.id);

      if (result.status === "success") {
        toast.success(result.message);
        router.refresh();
        onOpenChange(false);
        return;
      }

      toast.error(result.message ?? "Nao foi possivel remover o gasto.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir gasto?</DialogTitle>
          <DialogDescription>Esta acao nao pode ser desfeita.</DialogDescription>
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
            disabled={isPending}
          >
            {isPending ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseActionsDropdown({
  expense,
  groups,
  currency,
  selectedMonth,
}: {
  expense: ExpenseView;
  groups: ExpenseGroupOption[];
  currency: string;
  selectedMonth: string;
}) {
  const [openDialog, setOpenDialog] = useState<"edit" | "delete" | null>(null);
  const close = () => setOpenDialog(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Abrir acoes">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {!expense.creditCardPurchaseId && (
            <>
              <DropdownMenuItem onSelect={() => setOpenDialog("edit")}>
                <Pencil className="mr-2 size-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem
            onSelect={() => setOpenDialog("delete")}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {!expense.creditCardPurchaseId && (
        <ExpenseDialog
          expense={expense}
          groups={groups}
          currency={currency}
          selectedMonth={selectedMonth}
          open={openDialog === "edit"}
          onOpenChange={(o) => { if (!o) close(); }}
        />
      )}

      <DeleteExpenseDialog
        expense={expense}
        open={openDialog === "delete"}
        onOpenChange={(o) => { if (!o) close(); }}
      />
    </>
  );
}

const EXPENSES_PER_PAGE = 10;

function ExpensesListCard({
  groups,
  expenses,
  selectedMonth,
  isCurrentPeriod,
  currency,
  totalExpenses,
  currentPage,
  className,
}: Omit<ExpensesManagerProps, "groupTotals" | "commonExpenses"> & { className?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const totalPages = Math.ceil(totalExpenses / EXPENSES_PER_PAGE);
  const dateGroups = useMemo(() => groupExpensesByDate(expenses), [expenses]);

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams();
    params.set("month", selectedMonth);
    if (newPage > 1) params.set("page", String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  const pageItems = useMemo(() => {
    const items: (number | "ellipsis")[] = [];
    let prev: number | undefined;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= currentPage - 1 && i <= currentPage + 1)) {
        if (prev !== undefined && i - prev > 1) items.push("ellipsis");
        items.push(i);
        prev = i;
      }
    }

    return items;
  }, [currentPage, totalPages]);

  return (
    <Card className={className}>
      <CardHeader className="gap-1 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle>Gastos registrados</CardTitle>
            <CardDescription className="mt-1 capitalize">
              {formatReferenceMonth(selectedMonth)}
            </CardDescription>
          </div>
          <CreditCardExpenseDialog selectedMonth={selectedMonth} isCurrentPeriod={isCurrentPeriod} />
        </div>
      </CardHeader>
      <CardContent className="px-3 py-0 sm:p-6 sm:pt-0">
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
          <>
            <div className="hidden sm:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-12 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="whitespace-nowrap font-mono text-xs text-zinc-400">
                        {formatDate(expense.spentAt)}
                      </TableCell>
                      <TableCell className="font-medium">{expense.title}</TableCell>
                      <TableCell>
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
                      <TableCell className="text-right font-mono font-medium text-zinc-950">
                        {formatMoney(expense.amount, currency)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end">
                          <ExpenseActionsDropdown
                            expense={expense}
                            groups={groups}
                            currency={currency}
                            selectedMonth={selectedMonth}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="grid gap-4 py-2 sm:hidden">
              {dateGroups.map((group) => (
                <div key={group.day}>
                  <div className="flex items-baseline justify-between px-0.5 pb-2">
                    <p className="text-xs font-bold text-zinc-700">
                      {formatDayLabel(group.day)}{" "}
                      <span className="font-normal capitalize text-zinc-400">
                        · {formatWeekdayShort(group.day)}
                      </span>
                    </p>
                    <span className="font-mono text-xs text-zinc-400">
                      {formatMoney(group.total, currency)}
                    </span>
                  </div>
                  <div className="grid gap-2">
                    {group.items.map((expense) => (
                      <div
                        key={expense.id}
                        className="flex items-center gap-3 rounded-xl border p-3.5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-zinc-950">{expense.title}</p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
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
                        </div>
                        <span className="shrink-0 font-mono text-sm font-semibold text-zinc-950">
                          {formatMoney(expense.amount, currency)}
                        </span>
                        <ExpenseActionsDropdown
                          expense={expense}
                          groups={groups}
                          currency={currency}
                          selectedMonth={selectedMonth}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="border-t px-0 py-3 sm:px-6">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => handlePageChange(currentPage - 1)}
                        aria-disabled={currentPage === 1}
                        className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                    {pageItems.map((item, i) =>
                      item === "ellipsis" ? (
                        <PaginationItem key={`ellipsis-${i}`}>
                          <PaginationEllipsis />
                        </PaginationItem>
                      ) : (
                        <PaginationItem key={item}>
                          <PaginationLink
                            isActive={item === currentPage}
                            onClick={() => handlePageChange(item)}
                            className="cursor-pointer"
                          >
                            {item}
                          </PaginationLink>
                        </PaginationItem>
                      ),
                    )}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => handlePageChange(currentPage + 1)}
                        aria-disabled={currentPage === totalPages}
                        className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
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
  );
}

export function ExpensesManager({
  groups,
  groupTotals,
  expenses,
  commonExpenses,
  selectedMonth,
  isCurrentPeriod,
  currency,
  totalExpenses,
  currentPage,
}: ExpensesManagerProps) {
  const [mobileTab, setMobileTab] = useState<"lancamentos" | "grupos">("lancamentos");

  const visibleGroupTotals = groupTotals.filter(
    (g) => Number(g.monthlyAmount) > 0 || Number(g.spentAmount) > 0,
  );
  const hasGroupUsage = visibleGroupTotals.length > 0;

  const totalPlanned = groupTotals.reduce((sum, g) => sum + Number(g.monthlyAmount), 0);
  const totalSpent = groupTotals.reduce((sum, g) => sum + Number(g.spentAmount), 0);

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Gastos</p>
            <h1 className="mt-1 text-xl font-bold text-zinc-950 sm:text-2xl">Gastos</h1>
            <p className="mt-1 max-w-xs text-sm text-zinc-500 sm:max-w-md">
              Acompanhe seus lançamentos e o uso do orçamento mensal.
            </p>
          </div>
          <ExpenseDialog
            groups={groups}
            commonExpenses={commonExpenses}
            currency={currency}
            selectedMonth={selectedMonth}
            isCurrentPeriod={isCurrentPeriod}
            trigger={
              <Button
                size="icon-lg"
                className="rounded-xl sm:hidden"
                disabled={groups.length === 0}
                aria-label="Adicionar gasto"
              >
                <Plus />
              </Button>
            }
          />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <MonthControl selectedMonth={selectedMonth} className="w-full sm:w-auto" />
          <ExpenseDialog
            groups={groups}
            commonExpenses={commonExpenses}
            currency={currency}
            selectedMonth={selectedMonth}
            isCurrentPeriod={isCurrentPeriod}
            trigger={
              <Button className="hidden sm:inline-flex" disabled={groups.length === 0}>
                <Plus />
                Adicionar gasto
              </Button>
            }
          />
        </div>
      </div>

      <ExpenseKpis totalSpent={totalSpent} totalPlanned={totalPlanned} currency={currency} />

      <QuickExpenseCapture groups={groups} selectedMonth={selectedMonth} />

      {hasGroupUsage && (
        <div className="flex gap-1 rounded-xl border bg-background p-1 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileTab("lancamentos")}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
              mobileTab === "lancamentos" ? "bg-zinc-900 text-white" : "text-zinc-500",
            )}
          >
            Lançamentos
          </button>
          <button
            type="button"
            onClick={() => setMobileTab("grupos")}
            className={cn(
              "flex-1 rounded-lg py-2 text-sm font-semibold transition-colors",
              mobileTab === "grupos" ? "bg-zinc-900 text-white" : "text-zinc-500",
            )}
          >
            Uso por grupo
          </button>
        </div>
      )}

      <div className={cn("grid gap-4 sm:gap-6", hasGroupUsage && "lg:grid-cols-[1fr_380px]")}>
        <ExpensesListCard
          groups={groups}
          expenses={expenses}
          selectedMonth={selectedMonth}
          isCurrentPeriod={isCurrentPeriod}
          currency={currency}
          totalExpenses={totalExpenses}
          currentPage={currentPage}
          className={cn(hasGroupUsage && mobileTab !== "lancamentos" && "hidden lg:block")}
        />

        {hasGroupUsage && (
          <GroupUsageCard
            groupTotals={visibleGroupTotals}
            currency={currency}
            selectedMonth={selectedMonth}
            className={cn(mobileTab !== "grupos" && "hidden lg:block")}
          />
        )}
      </div>
    </div>
  );
}
