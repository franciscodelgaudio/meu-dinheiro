"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Search, User as UserIcon, UserPlus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
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
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

type User = {
  _id: string;
  name: string;
  email: string | null;
  createdAt: string;
};

type UserListResponse = {
  data: User[];
  page: number;
  totalPages: number;
};

const GRID_COLUMNS = "2fr 2fr 1fr";

// Páginas visíveis ao redor da atual; o restante vira reticências.
const PAGE_SIBLINGS = 1;

function getPageRange(page: number, totalPages: number): (number | "ellipsis")[] {
  const pages = new Set<number>([1, totalPages]);
  for (let offset = -PAGE_SIBLINGS; offset <= PAGE_SIBLINGS; offset++) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= totalPages) {
      pages.add(candidate);
    }
  }

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];
  sorted.forEach((current, index) => {
    if (index > 0 && current - sorted[index - 1] > 1) {
      result.push("ellipsis");
    }
    result.push(current);
  });
  return result;
}

export default function Home() {
  const router = useRouter();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<User[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const isFetchingRef = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  function loadPage(targetPage: number) {
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;
    setStatus("loading");

    const url = new URL("/api/v1/user", window.location.origin);
    url.searchParams.set("page", String(targetPage));
    if (search) {
      url.searchParams.set("search", search);
    }

    fetch(url)
      .then(async (response) => {
        const data: UserListResponse = await response.json();
        if (!response.ok) {
          throw new Error("Failed to load users");
        }
        setUsers(data.data);
        setTotalPages(Math.max(data.totalPages, 1));
        setPage(data.page);
        setStatus("idle");
      })
      .catch(() => setStatus("error"))
      .finally(() => {
        isFetchingRef.current = false;
      });
  }

  useEffect(() => {
    loadPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-col gap-4">
          <div className="flex flex-row items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Usuários</h1>
              <p className="text-sm text-muted-foreground">
                Todos os usuários cadastrados no Meu Dinheiro.
              </p>
            </div>
            <Link href="/users/new" className={cn(buttonVariants())}>
              <UserPlus />
              Novo usuário
            </Link>
          </div>

          <div className="relative max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Buscar por nome ou email..."
              className="pl-8"
            />
          </div>
        </div>

        {status === "error" && (
          <p className="text-sm text-destructive">Erro ao carregar usuários.</p>
        )}
        {status !== "error" && users.length === 0 && status === "idle" && (
          <p className="text-sm text-muted-foreground">Nenhum usuário encontrado.</p>
        )}
        {users.length > 0 && (
          <div className="overflow-hidden rounded-md border">
            <Table style={{ display: "grid" }}>
              <TableHeader
                className="sticky top-0 z-10 bg-muted/95"
                style={{ display: "grid" }}
              >
                <TableRow className="hover:bg-transparent" style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS }}>
                  <TableHead className="flex items-center gap-2">
                    <UserIcon className="size-4" />
                    Nome
                  </TableHead>
                  <TableHead className="flex items-center gap-2">
                    <Mail className="size-4" />
                    Email
                  </TableHead>
                  <TableHead className="flex items-center justify-end">Criado em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody style={{ display: "grid" }}>
                {users.map((user) => (
                  <TableRow
                    key={user._id}
                    onClick={() => router.push(`/users/${user._id}`)}
                    className="cursor-pointer"
                    style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS }}
                  >
                    <TableCell className="flex items-center truncate">{user.name}</TableCell>
                    <TableCell className="flex items-center truncate text-muted-foreground">
                      {user.email ?? "-"}
                    </TableCell>
                    <TableCell className="flex items-center justify-end text-muted-foreground">
                      {new Date(user.createdAt).toLocaleDateString("pt-BR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {totalPages > 1 && (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  text="Anterior"
                  aria-disabled={page === 1}
                  className={page === 1 ? "pointer-events-none opacity-50" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    if (page > 1) loadPage(page - 1);
                  }}
                />
              </PaginationItem>
              {getPageRange(page, totalPages).map((item, index) =>
                item === "ellipsis" ? (
                  <PaginationItem key={`ellipsis-${index}`}>
                    <PaginationEllipsis />
                  </PaginationItem>
                ) : (
                  <PaginationItem key={item}>
                    <PaginationLink
                      href="#"
                      isActive={item === page}
                      onClick={(event) => {
                        event.preventDefault();
                        if (item !== page) loadPage(item);
                      }}
                    >
                      {item}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  href="#"
                  text="Próxima"
                  aria-disabled={page === totalPages}
                  className={page === totalPages ? "pointer-events-none opacity-50" : undefined}
                  onClick={(event) => {
                    event.preventDefault();
                    if (page < totalPages) loadPage(page + 1);
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}
      </div>
    </div>
  );
}
