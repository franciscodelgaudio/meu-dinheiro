"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CalendarDays,
  MoreHorizontal,
  Pencil,
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
import { CreateGroupSheet } from "@/components/groups/create-group-sheet";
import { EditGroupSheet } from "@/components/groups/edit-group-sheet";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { formatMonthYear } from "@/components/month-picker";
import { formatCurrency } from "@/lib/utils/currency";
import { useCursorPaginationVirtualizer } from "@/lib/hooks/use-cursor-pagination-virtualizer";

type Group = {
  _id: string;
  name: string;
  description: string | null;
  date: { month: string; year: number }[];
  total: number;
  color: string | null;
};

type GroupListResponse = {
  data: Group[];
  page: number;
  totalPages: number;
};

const GRID_COLUMNS = "2fr 2fr 1.5fr 1fr";
const ROW_HEIGHT = 44;

type SortField = "name" | "total" | "createdAt";
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

export default function GroupsPage() {
  const { id: userId } = useParams<{ id: string }>();
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<Group | null>(null);
  const [sortBy, setSortBy] = useState<SortField>("createdAt");
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
    items: groups,
    status,
    scrollRef,
    headerRef,
    rowVirtualizer,
    virtualItems,
    reload,
  } = useCursorPaginationVirtualizer<Group>({
    estimateSize: ROW_HEIGHT,
    deps: [userId, sortBy, sortOrder, search],
    fetchPage: async (cursor) => {
      const url = new URL(`/api/v1/user/${userId}/group`, window.location.origin);
      url.searchParams.set("sortBy", sortBy);
      url.searchParams.set("sort", sortOrder);
      url.searchParams.set("page", cursor ?? "1");
      if (search) {
        url.searchParams.set("search", search);
      }

      const response = await fetch(url);
      const data: GroupListResponse = await response.json();

      if (!response.ok) {
        throw new Error("Failed to load groups");
      }

      return {
        data: data.data,
        hasNextPage: data.page < data.totalPages,
        nextCursor: data.page < data.totalPages ? String(data.page + 1) : null,
      };
    },
  });

  async function handleDelete(group: Group) {
    const response = await fetch(`/api/v1/user/${userId}/group/${group._id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      window.alert("Erro ao excluir grupo.");
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
              <h1 className="text-lg font-semibold tracking-tight">Grupos</h1>
              <p className="text-sm text-muted-foreground break-all">
                Grupos de orçamento do usuário {userId}.
              </p>
            </div>
            <CreateGroupSheet userId={userId} onCreated={reload} />
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

        <EditGroupSheet
          userId={userId}
          group={editingGroup}
          onOpenChange={(open) => {
            if (!open) setEditingGroup(null);
          }}
          onUpdated={reload}
        />

        <ConfirmDialog
          open={deletingGroup !== null}
          onOpenChange={(open) => {
            if (!open) setDeletingGroup(null);
          }}
          title="Excluir grupo"
          description={`Tem certeza que deseja excluir "${deletingGroup?.name}"? Essa ação não pode ser desfeita.`}
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={() => {
            if (deletingGroup) return handleDelete(deletingGroup);
          }}
        />

        {status === "error" && (
          <p className="text-sm text-destructive">Erro ao carregar grupos.</p>
        )}
        {status !== "error" && groups.length === 0 && status === "idle" && (
          <p className="text-sm text-muted-foreground">Nenhum grupo encontrado.</p>
        )}
        {groups.length > 0 && (
          <div className="overflow-hidden rounded-md border">
            <Table style={{ display: "grid" }}>
              <TableHeader
                className="sticky top-0 z-10 bg-muted/95"
                style={{ display: "grid" }}
              >
                <TableRow className="hover:bg-transparent" style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS }}>
                  <TableHead className="flex items-center gap-2">
                    <Tag className="size-4" />
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
                    Meses
                  </TableHead>
                  <TableHead className="flex items-center justify-end gap-2 text-right">
                    <Wallet className="size-4" />
                    <SortableHeader
                      active={sortBy === "total"}
                      order={sortOrder}
                      onClick={() => toggleSort("total")}
                    >
                      Valor total
                    </SortableHeader>
                  </TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody
                style={{ display: "grid", height: rowVirtualizer.getTotalSize(), position: "relative" }}
              >
                {virtualItems.map((virtualRow) => {
                  const group = groups[virtualRow.index];
                  return (
                    <TableRow
                      key={group._id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: GRID_COLUMNS,
                        position: "absolute",
                        width: "100%",
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start - rowVirtualizer.options.scrollMargin}px)`,
                      }}
                    >
                      <TableCell className="flex items-center gap-2 truncate">
                        <span
                          className="size-2.5 shrink-0 rounded-full border"
                          style={{ backgroundColor: group.color ?? undefined }}
                        />
                        <span className="truncate">{group.name}</span>
                      </TableCell>
                      <TableCell className="flex items-center gap-1 overflow-hidden">
                        {group.date.map((item) => (
                          <Badge key={`${item.month}-${item.year}`} variant="secondary">
                            {formatMonthYear({ month: item.month, year: String(item.year) })}
                          </Badge>
                        ))}
                      </TableCell>
                      <TableCell className="flex items-center justify-end text-right">
                        {formatCurrency(group.total)}
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
                            <DropdownMenuItem onClick={() => setEditingGroup(group)}>
                              <Pencil />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeletingGroup(group)}
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
