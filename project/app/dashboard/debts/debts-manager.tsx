"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarIcon,
  CheckCheck,
  CreditCard,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  createDebt,
  deleteDebt,
  deleteCreditCardPurchase,
  payDebtInstallment,
  unpayDebtInstallment,
  updateCreditCardPurchase,
  updateDebt,
  type DebtActionState,
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
  isPaid: boolean;
  paymentExpenseId: string | null;
  paymentDay: number | null;
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

function getTodayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getDefaultPaymentDate(selectedMonth: string, paymentDay: number | null): string {
  if (!paymentDay) return getTodayISO();

  const [year, month] = selectedMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const day = Math.min(paymentDay, daysInMonth);

  return `${selectedMonth}-${String(day).padStart(2, "0")}`;
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

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`acquiredAt-${debt?.id ?? "new"}`}>Data de origem</Label>
              <Input
                id={`acquiredAt-${debt?.id ?? "new"}`}
                name="acquiredAt"
                type="date"
                defaultValue={formatDateInput(debt?.acquiredAt ?? null)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`paymentDay-${debt?.id ?? "new"}`}>
                Vence todo dia
              </Label>
              <Input
                id={`paymentDay-${debt?.id ?? "new"}`}
                name="paymentDay"
                type="number"
                min="1"
                max="31"
                step="1"
                defaultValue={debt?.paymentDay ?? ""}
                placeholder="Ex: 15"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
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

function CreditCardPurchaseDialog({ debt }: { debt: DebtView }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(updateCreditCardPurchase, initialState);

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
        <Button variant="outline" size="icon-sm" aria-label="Editar compra parcelada">
          <Pencil />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Editar compra parcelada</DialogTitle>
          <DialogDescription>
            Altere os dados da compra no cartao de credito.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-5">
          <input type="hidden" name="id" value={debt.id} />

          <div className="grid gap-2">
            <Label htmlFor={`title-${debt.id}`}>Descricao</Label>
            <Input
              id={`title-${debt.id}`}
              name="title"
              defaultValue={debt.name}
              placeholder="Nome da compra..."
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`purchasedAt-${debt.id}`}>Data da compra</Label>
              <Input
                id={`purchasedAt-${debt.id}`}
                name="purchasedAt"
                type="date"
                defaultValue={formatDateInput(debt.acquiredAt)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`paymentDay-cc-${debt.id}`}>
                Vencimento da fatura (dia)
              </Label>
              <Input
                id={`paymentDay-cc-${debt.id}`}
                name="paymentDay"
                type="number"
                min="1"
                max="31"
                step="1"
                defaultValue={debt.paymentDay ?? ""}
                placeholder="Ex: 10"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor={`firstInstallmentMonth-${debt.id}`}>
                Primeira fatura
              </Label>
              <Input
                id={`firstInstallmentMonth-${debt.id}`}
                name="firstInstallmentMonth"
                type="month"
                defaultValue={debt.firstPaymentMonth}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`installmentCount-cc-${debt.id}`}>
                Parcelas
              </Label>
              <Input
                id={`installmentCount-cc-${debt.id}`}
                name="installmentCount"
                type="number"
                min="1"
                max="120"
                step="1"
                defaultValue={debt.installmentCount}
                required
              />
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`totalAmount-cc-${debt.id}`}>Valor total</Label>
            <Input
              id={`totalAmount-cc-${debt.id}`}
              name="totalAmount"
              type="number"
              min="0"
              step="0.01"
              defaultValue={debt.totalAmount}
              placeholder="0,00"
              required
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

function PayInstallmentDialog({
  debt,
  currency,
  selectedMonth,
}: {
  debt: DebtView;
  currency: string;
  selectedMonth: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(payDebtInstallment, initialState);

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

  const defaultDate = getDefaultPaymentDate(selectedMonth, debt.paymentDay);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Registrar pagamento">
          <CheckCheck />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar pagamento</DialogTitle>
          <DialogDescription>
            Parcela {debt.installmentNumber}/{debt.installmentCount} de{" "}
            <span className="font-medium text-foreground">{debt.name}</span>
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="grid gap-4">
          <input type="hidden" name="creditCardPurchaseId" value={debt.id} />
          <input
            type="hidden"
            name="installmentNumber"
            value={debt.installmentNumber ?? ""}
          />

          <div className="rounded-md bg-muted px-3 py-2 text-sm">
            <p className="text-muted-foreground">Valor da parcela</p>
            <p className="mt-0.5 text-base font-semibold">
              {formatMoney(debt.installmentAmount, currency)}
            </p>
            {debt.paymentDay ? (
              <p className="mt-1 text-xs text-muted-foreground">
                Vence todo dia {debt.paymentDay}
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`paidAt-${debt.id}`}>Data do pagamento</Label>
            <Input
              id={`paidAt-${debt.id}`}
              name="paidAt"
              type="date"
              defaultValue={defaultDate}
              required
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                Cancelar
              </Button>
            </DialogClose>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Registrando..." : "Confirmar pagamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UnpayButton({ debt }: { debt: DebtView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleUnpay() {
    startTransition(async () => {
      const result = await unpayDebtInstallment(debt.paymentExpenseId!);

      if (result.status === "success") {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(result.message ?? "Nao foi possivel desfazer o pagamento.");
    });
  }

  return (
    <Button
      variant="outline"
      size="icon-sm"
      aria-label="Desfazer pagamento"
      onClick={handleUnpay}
      disabled={isPending}
    >
      <RotateCcw />
    </Button>
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

function DeleteCreditCardButton({ debt }: { debt: DebtView }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteCreditCardPurchase(debt.id);

      if (result.status === "success") {
        toast.success(result.message);
        router.refresh();
        return;
      }

      toast.error(result.message ?? "Nao foi possivel remover a compra.");
    });
  }

  return (
    <Button
      variant="destructive"
      size="icon-sm"
      aria-label="Excluir compra parcelada"
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
  const paidCount = useMemo(
    () => debts.filter((d) => d.isPaid).length,
    [debts],
  );
  const paidPercentage =
    totalOriginal > 0
      ? ((totalOriginal - totalRemainingAfterMonth) / totalOriginal) * 100
      : 0;

  return (
    <div className="grid gap-4 sm:gap-6">
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="gap-0 pb-0">
            <div className="flex items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle>Compromissos do mes</CardTitle>
                <CardDescription className="mt-1 capitalize">
                  {formatReferenceMonth(selectedMonth)}
                </CardDescription>
              </div>
              <DebtDialog selectedMonth={selectedMonth} />
            </div>
            <div className="flex items-center border-t border-zinc-100 pt-3">
              <MonthSelector selectedMonth={selectedMonth} />
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            {debts.length > 0 ? (
              <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Compromisso</TableHead>
                      <TableHead className="hidden sm:table-cell">Vencimento</TableHead>
                      <TableHead className="hidden sm:table-cell">Parcela</TableHead>
                      <TableHead>Valor no mes</TableHead>
                      <TableHead className="w-28 text-right">Acoes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {debts.map((debt) => (
                      <TableRow key={debt.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{debt.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              {debt.kind === "credit_card" ? (
                                <Badge variant="outline" className="gap-1 text-xs">
                                  <CreditCard className="size-3" />
                                  Parcelado
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-xs">Divida</Badge>
                              )}
                              {debt.installmentNumber ? (
                                <>
                                  <Badge variant="outline" className="text-xs sm:hidden">
                                    {debt.installmentNumber}/{debt.installmentCount}
                                  </Badge>
                                  {debt.isPaid ? (
                                    <Badge className="w-fit bg-green-600 text-xs text-white hover:bg-green-600 sm:hidden">
                                      Pago
                                    </Badge>
                                  ) : (
                                    <Badge variant="secondary" className="w-fit text-xs sm:hidden">
                                      Pendente
                                    </Badge>
                                  )}
                                </>
                              ) : null}
                            </div>
                            {debt.paymentDay ? (
                              <p className="mt-1 text-xs text-zinc-400 sm:hidden">
                                Vence dia {debt.paymentDay}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {debt.paymentDay ? (
                            <div>
                              <p className="font-medium">Dia {debt.paymentDay}</p>
                              <p className="text-xs text-muted-foreground">todo mes</p>
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">Nao informado</p>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {debt.installmentNumber ? (
                            <div className="flex flex-col gap-1">
                              <Badge variant="outline">
                                {debt.installmentNumber}/{debt.installmentCount}
                              </Badge>
                              {debt.isPaid ? (
                                <Badge className="w-fit bg-green-600 hover:bg-green-600 text-white">
                                  Pago
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="w-fit">
                                  Pendente
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <Badge variant="secondary">fora do mes</Badge>
                          )}
                        </TableCell>
                        <TableCell
                          className={`font-medium ${debt.isPaid ? "text-green-700" : "text-red-700"}`}
                        >
                          {formatMoney(debt.installmentAmount, currency)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {debt.installmentNumber !== null && !debt.isPaid ? (
                              <PayInstallmentDialog
                                debt={debt}
                                currency={currency}
                                selectedMonth={selectedMonth}
                              />
                            ) : null}
                            {debt.isPaid && debt.paymentExpenseId ? (
                              <UnpayButton debt={debt} />
                            ) : null}
                            {debt.kind === "debt" ? (
                              <>
                                <DebtDialog debt={debt} selectedMonth={selectedMonth} />
                                <DeleteDebtButton debt={debt} />
                              </>
                            ) : (
                              <>
                                <CreditCardPurchaseDialog debt={debt} />
                                <DeleteCreditCardButton debt={debt} />
                              </>
                            )}
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
                  Pagos este mes
                </span>
                <span className="font-medium text-green-700">{paidCount}</span>
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
          <CardContent className="p-0 sm:p-6 sm:pt-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Compromisso</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Antes do mes</TableHead>
                  <TableHead className="text-right">Restante</TableHead>
                  <TableHead className="w-16 text-right sm:w-20">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debts.map((debt) => {
                  const paidBefore = Number(debt.paidBeforeMonth);
                  const total = Number(debt.totalAmount);
                  const remaining = Number(debt.remainingAfterMonth);
                  const paidAfterThisMonth = total - remaining;
                  const percentage = total > 0 ? (paidAfterThisMonth / total) * 100 : 0;

                  return (
                    <TableRow key={debt.id}>
                      <TableCell>
                        <p className="font-medium">{debt.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {debt.source}
                          {debt.paymentDay ? ` · vence dia ${debt.paymentDay}` : ""}
                        </p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-right whitespace-nowrap text-muted-foreground">
                        {formatMoney(paidBefore, currency)}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium">
                        {formatMoney(remaining, currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={percentage >= 100 ? "secondary" : "outline"}>
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
