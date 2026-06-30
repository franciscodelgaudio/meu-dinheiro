"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarIcon,
  Check,
  ChevronsUpDown,
  ImagePlus,
  CreditCard,
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

export type CommonExpenseTemplate = {
  title: string;
  amount: string;
  behaviorType: string;
  coverageDays: number;
  expenseGroupId: string;
  count: number;
};

type ExpensesManagerProps = {
  groups: ExpenseGroupOption[];
  groupTotals: ExpenseGroupTotal[];
  expenses: ExpenseView[];
  commonExpenses: CommonExpenseTemplate[];
  selectedMonth: string;
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
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const imageInputRef = useRef<HTMLInputElement>(null);
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
              <div className="flex items-center justify-between gap-3">
                <Label className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-50">
                  <ImagePlus className="size-4 shrink-0" />
                  {selectedImages.length > 0 ? "Adicionar mais" : "Imagem"}
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
  commonExpenses,
  currency,
  selectedMonth,
}: {
  expense?: ExpenseView;
  groups: ExpenseGroupOption[];
  commonExpenses?: CommonExpenseTemplate[];
  currency: string;
  selectedMonth: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaultSpentAt = expense
    ? formatDateInput(expense.spentAt)
    : getDefaultSpentAt(selectedMonth);
  const [selectedGroupId, setSelectedGroupId] = useState(
    expense?.expenseGroupId ?? groups[0]?.id ?? "",
  );
  const [groupComboboxOpen, setGroupComboboxOpen] = useState(false);
  const [spentAt, setSpentAt] = useState(defaultSpentAt);
  const [title, setTitle] = useState(expense?.title ?? "");
  const [amount, setAmount] = useState(expense?.amount ?? "");
  const [behaviorType, setBehaviorType] = useState(
    expense?.behaviorType ?? "single",
  );
  const [coverageDays, setCoverageDays] = useState(
    String(expense?.coverageDays ?? 1),
  );
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
    setBehaviorType(template.behaviorType);
    setCoverageDays(String(template.coverageDays));
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
          <input type="hidden" name="behaviorType" value={behaviorType} />
          <input type="hidden" name="coverageDays" value={coverageDays} />

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

function DeleteExpenseButton({ expense }: { expense: ExpenseView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteExpense(expense.id);

      if (result.status === "success") {
        toast.success(result.message);
        router.refresh();
        setOpen(false);
        return;
      }

      toast.error(result.message ?? "Nao foi possivel remover o gasto.");
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="icon-sm" aria-label="Excluir gasto">
          <Trash2 />
        </Button>
      </DialogTrigger>
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

const EXPENSES_PER_PAGE = 10;

export function ExpensesManager({
  groups,
  groupTotals,
  expenses,
  commonExpenses,
  selectedMonth,
  currency,
  totalExpenses,
  currentPage,
}: ExpensesManagerProps) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleGroupTotals = groupTotals.filter(
    (g) => Number(g.monthlyAmount) > 0 || Number(g.spentAmount) > 0,
  );

  const totalPages = Math.ceil(totalExpenses / EXPENSES_PER_PAGE);

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
    <div className="grid gap-4 sm:gap-6">
      <QuickExpenseCapture groups={groups} selectedMonth={selectedMonth} />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader className="gap-0 pb-0">
            <div className="flex items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle>Gastos registrados</CardTitle>
                <CardDescription className="mt-1 capitalize">
                  {formatReferenceMonth(selectedMonth)}
                </CardDescription>
              </div>
              <ExpenseDialog
                groups={groups}
                commonExpenses={commonExpenses}
                currency={currency}
                selectedMonth={selectedMonth}
              />
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
              <>
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
                                currency={currency}
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
                {totalPages > 1 && (
                  <div className="border-t px-6 py-3">
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

        {visibleGroupTotals.length > 0 && (
          <Card className="h-fit border-zinc-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-zinc-800">Uso por grupo</CardTitle>
              <CardDescription className="capitalize">{formatReferenceMonth(selectedMonth)}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              {visibleGroupTotals.map((group) => {
                const planned = Number(group.monthlyAmount);
                const spent = Number(group.spentAmount);
                const percentage = getPercentage(spent, planned);
                const isOver = percentage > 100;

                return (
                  <div key={group.id} className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} />
                        <span className="truncate text-xs font-medium text-zinc-700">{group.name}</span>
                      </div>
                      <Badge variant={isOver ? "destructive" : "secondary"} className="shrink-0 text-xs">
                        {new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(percentage)}%
                      </Badge>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(percentage, 100)}%`,
                          backgroundColor: isOver ? "#dc2626" : group.color,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-zinc-400">{formatMoney(spent, currency)}</span>
                      <span className="text-xs text-zinc-400">de {formatMoney(planned, currency)}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
