"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  Layers,
  MoreHorizontal,
  Pencil,
  Receipt,
  Search,
  Tag,
  Trash2,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { EditCashflowSheet } from "@/components/cashflows/edit-cashflow-sheet";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatCurrency } from "@/lib/utils/currency";
import { useCursorPaginationVirtualizer } from "@/lib/hooks/use-cursor-pagination-virtualizer";

type Cashflow = {
  _id: string;
  name: string;
  description: string | null;
  date: string;
  total: number;
  type: "income" | "expense";
  groupId: string | null;
  group?: { _id: string; name: string; color: string | null } | null;
};

type CashflowListResponse = {
  data: Cashflow[];
  hasNextPage: boolean;
  nextCursor: string | null;
};

const GRID_COLUMNS = "2fr 1fr 1fr 1fr 1fr 3rem";
const ROW_HEIGHT = 44;

type SortField = "name" | "date";
type SortOrder = "asc" | "desc";

type SortableHeaderProps = {
  active: boolean;
  order: SortOrder;
  onClick: () => void;
  children: ReactNode;
};

function SortableHeader({ active, order, onClick, children }: SortableHeaderProps) {
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 outline-none hover:text-foreground"
    >
      {children}
      <Icon className={`size-3.5 ${active ? "text-foreground" : "text-muted-foreground/50"}`} />
    </button>
  );
}

export default function CashflowsPage() {
  const { id: userId } = useParams<{ id: string }>();
  const [editingCashflow, setEditingCashflow] = useState<Cashflow | null>(null);
  const [deletingCashflow, setDeletingCashflow] = useState<Cashflow | null>(null);
  const [sortBy, setSortBy] = useState<SortField>("date");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  function toggleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((order) => (order === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

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
    deps: [userId, sortBy, sortOrder, search],
    fetchPage: async (cursor) => {
      const url = new URL(`/api/v1/user/${userId}/cashflow`, window.location.origin);
      url.searchParams.set("sortBy", sortBy);
      url.searchParams.set("sort", sortOrder);
      if (search) {
        url.searchParams.set("search", search);
      }
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

  async function handleDelete(cashflow: Cashflow) {
    const response = await fetch(`/api/v1/user/${userId}/cashflow/${cashflow._id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      window.alert("Erro ao excluir lançamento.");
      return;
    }

    reload();
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4 p-4">
        <div ref={headerRef} className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Lançamentos</h1>
              <p className="text-sm text-muted-foreground break-all">
                Entradas e saídas do usuário {userId}.
              </p>
            </div>
            <CreateCashflowSheet userId={userId} onCreated={reload} />
          </div>

          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nome..."
              className="pl-8"
            />
          </div>
        </div>

        <EditCashflowSheet
          userId={userId}
          cashflow={editingCashflow}
          onOpenChange={(open) => {
            if (!open) setEditingCashflow(null);
          }}
          onUpdated={reload}
        />

        <ConfirmDialog
          open={deletingCashflow !== null}
          onOpenChange={(open) => {
            if (!open) setDeletingCashflow(null);
          }}
          title="Excluir lançamento"
          description={`Tem certeza que deseja excluir "${deletingCashflow?.name}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={() => {
            if (deletingCashflow) return handleDelete(deletingCashflow);
          }}
        />

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
                    <SortableHeader
                      active={sortBy === "name"}
                      order={sortOrder}
                      onClick={() => toggleSort("name")}
                    >
                      Nome
                    </SortableHeader>
                  </TableHead>
                  <TableHead className="flex items-center gap-2">
                    <CalendarDays className="size-4" />
                    <SortableHeader
                      active={sortBy === "date"}
                      order={sortOrder}
                      onClick={() => toggleSort("date")}
                    >
                      Data
                    </SortableHeader>
                  </TableHead>
                  <TableHead className="flex items-center gap-2">
                    <Tag className="size-4" />
                    Tipo
                  </TableHead>
                  <TableHead className="flex items-center gap-2">
                    <Layers className="size-4" />
                    Grupo
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
                      <TableCell className="flex items-center truncate">
                        {cashflow.group ? (
                          <Badge
                            variant="outline"
                            className="gap-1.5 truncate"
                            style={{ borderColor: cashflow.group.color ?? undefined }}
                          >
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: cashflow.group.color ?? "#71717a" }}
                            />
                            <span className="truncate">{cashflow.group.name}</span>
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
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
                            <DropdownMenuItem onClick={() => setEditingCashflow(cashflow)}>
                              <Pencil />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeletingCashflow(cashflow)}
                            >
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
