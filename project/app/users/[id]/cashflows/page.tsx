"use client";

import { useParams } from "next/navigation";
import { CalendarDays, MoreHorizontal, Pencil, Receipt, Tag, Trash2, Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateCashflowSheet } from "@/components/cashflows/create-cashflow-sheet";
import { formatCurrency } from "@/lib/utils/currency";
import { useCursorPaginationVirtualizer } from "@/lib/hooks/use-cursor-pagination-virtualizer";

type Cashflow = {
  _id: string;
  name: string;
  description: string | null;
  date: string;
  total: number;
  type: "income" | "expense";
};

type CashflowListResponse = {
  data: Cashflow[];
  hasNextPage: boolean;
  nextCursor: string | null;
};

const GRID_COLUMNS = "2fr 1fr 1fr 1fr 3rem";
const ROW_HEIGHT = 44;

export default function CashflowsPage() {
  const { id: userId } = useParams<{ id: string }>();

  const {
    items: cashflows,
    status,
    scrollRef,
    headerRef,
    rowVirtualizer,
    virtualItems,
    reload,
  } = useCursorPaginationVirtualizer<Cashflow>({
    estimateSize: ROW_HEIGHT,
    deps: [userId],
    fetchPage: async (cursor) => {
      const url = new URL(`/api/v1/user/${userId}/cashflow`, window.location.origin);
      if (cursor) {
        url.searchParams.set("cursor", cursor);
      }

      const response = await fetch(url);
      const data: CashflowListResponse = await response.json();

      if (!response.ok) {
        throw new Error("Failed to load cashflows");
      }

      return data;
    },
  });

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4 p-4">
        <div ref={headerRef} className="flex flex-row items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Lançamentos</h1>
            <p className="text-sm text-muted-foreground break-all">
              Entradas e saídas do usuário {userId}.
            </p>
          </div>
          <CreateCashflowSheet userId={userId} onCreated={reload} />
        </div>

        {status === "error" && (
          <p className="text-sm text-destructive">Erro ao carregar lançamentos.</p>
        )}
        {status !== "error" && cashflows.length === 0 && status === "idle" && (
          <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
        )}
        {cashflows.length > 0 && (
          <div className="overflow-hidden rounded-md border">
            <Table style={{ display: "grid" }}>
              <TableHeader
                className="sticky top-0 z-10 bg-muted/95"
                style={{ display: "grid" }}
              >
                <TableRow className="hover:bg-transparent" style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS }}>
                  <TableHead className="flex items-center gap-2">
                    <Receipt className="size-4" />
                    Nome
                  </TableHead>
                  <TableHead className="flex items-center gap-2">
                    <CalendarDays className="size-4" />
                    Data
                  </TableHead>
                  <TableHead className="flex items-center gap-2">
                    <Tag className="size-4" />
                    Tipo
                  </TableHead>
                  <TableHead className="flex items-center justify-end gap-2 text-right">
                    <Wallet className="size-4" />
                    Valor
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody
                style={{ display: "grid", height: rowVirtualizer.getTotalSize(), position: "relative" }}
              >
                {virtualItems.map((virtualRow) => {
                  const cashflow = cashflows[virtualRow.index];
                  return (
                    <TableRow
                      key={cashflow._id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: GRID_COLUMNS,
                        position: "absolute",
                        width: "100%",
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                      }}
                    >
                      <TableCell className="flex items-center truncate">{cashflow.name}</TableCell>
                      <TableCell className="flex items-center">
                        {new Date(cashflow.date).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="flex items-center">
                        <Badge variant={cashflow.type === "income" ? "default" : "destructive"}>
                          {cashflow.type === "income" ? "Entrada" : "Saída"}
                        </Badge>
                      </TableCell>
                      <TableCell className="flex items-center justify-end text-right">
                        {formatCurrency(cashflow.total)}
                      </TableCell>
                      <TableCell className="flex items-center justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal />
                                <span className="sr-only">Ações</span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent>
                            <DropdownMenuItem>
                              <Pencil />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem variant="destructive">
                              <Trash2 />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
