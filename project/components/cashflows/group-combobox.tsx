"use client";

import { useEffect, useState, type UIEvent } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Group = {
  _id: string;
  name: string;
};

type GroupListResponse = {
  data: Group[];
  page: number;
  totalPages: number;
};

type GroupComboboxProps = {
  id?: string;
  userId: string;
  value: string;
  onChange: (groupId: string) => void;
};

const PAGE_LIMIT = 20;

function buildUrl(userId: string, params: Record<string, string | number>) {
  const url = new URL(`/api/v1/user/${userId}/group`, window.location.origin);
  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, String(val));
  }
  return url;
}

async function fetchGroups(userId: string, params: Record<string, string | number>) {
  const response = await fetch(buildUrl(userId, params));
  return (await response.json()) as GroupListResponse;
}

export function GroupCombobox({ id, userId, value, onChange }: GroupComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // Resolve o nome do grupo já selecionado (ex.: ao abrir o sheet de edição),
  // já que a lista paginada só carrega ao abrir o popover.
  useEffect(() => {
    let cancelled = false;

    async function syncSelectedGroup() {
      if (!value) {
        setSelectedGroup(null);
        return;
      }
      const data = await fetchGroups(userId, { id: value });
      if (!cancelled) setSelectedGroup(data.data[0] ?? null);
    }

    syncSelectedGroup();

    return () => {
      cancelled = true;
    };
  }, [value, userId]);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadFirstPage() {
      setLoading(true);
      try {
        const data = await fetchGroups(userId, { page: 1, limit: PAGE_LIMIT, search, sortBy: "name", sort: "asc" });
        if (cancelled) return;
        setGroups(data.data);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFirstPage();

    return () => {
      cancelled = true;
    };
  }, [open, search, userId]);

  async function loadMore() {
    if (loading || page >= totalPages) return;

    setLoading(true);
    try {
      const nextPage = page + 1;
      const data = await fetchGroups(userId, { page: nextPage, limit: PAGE_LIMIT, search, sortBy: "name", sort: "asc" });
      setGroups((prev) => [...prev, ...data.data]);
      setPage(data.page);
      setTotalPages(data.totalPages);
    } finally {
      setLoading(false);
    }
  }

  function handleScroll(event: UIEvent<HTMLDivElement>) {
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight < 40) {
      loadMore();
    }
  }

  function handleSelect(group: Group | null) {
    onChange(group?._id ?? "");
    setSelectedGroup(group);
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setSearchInput("");
      }}
    >
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          />
        }
      >
        <span className={cn("truncate", !selectedGroup && "text-muted-foreground")}>
          {selectedGroup ? selectedGroup.name : "Selecionar grupo (opcional)"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0">
        <Command shouldFilter={false}>
          <CommandInput
            value={searchInput}
            onValueChange={setSearchInput}
            placeholder="Buscar grupo..."
          />
          <CommandList onScroll={handleScroll}>
            <CommandEmpty>{loading ? "Carregando..." : "Nenhum grupo encontrado."}</CommandEmpty>
            <CommandGroup>
              <CommandItem data-checked={!value} onSelect={() => handleSelect(null)}>
                Nenhum
              </CommandItem>
              {groups.map((group) => (
                <CommandItem
                  key={group._id}
                  value={group._id}
                  data-checked={value === group._id}
                  onSelect={() => handleSelect(group)}
                >
                  {group.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
