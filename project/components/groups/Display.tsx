"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateGroupDialog } from "@/components/groups/CreateGroupDialog";
import { MonthPicker } from "@/components/groups/MonthPicker";

export type GroupListItem = {
  id: string;
  name: string;
  description: string | null;
  referenceMonth: string;
  monthlyAmount: number;
  color: string;
};

type DisplayProps = {
  groups: GroupListItem[];
  page: number;
  totalPages: number;
  total: number;
  referenceMonth: string;
  name: string;
  userId: string;
};

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function Display({
  groups,
  page,
  totalPages,
  total,
  referenceMonth,
  name,
  userId,
}: DisplayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [nameInput, setNameInput] = useState(name);

  function pushParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    if (nameInput === name) return;
    const timeout = setTimeout(() => pushParams({ name: nameInput || null }), 400);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameInput]);

  function buildPageHref(targetPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(targetPage));
    return `${pathname}?${params.toString()}`;
  }

  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Grupos de gastos</CardTitle>
          <CreateGroupDialog userId={userId} />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            placeholder="Buscar por nome"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
            className="sm:w-56"
          />
          <MonthPicker
            value={referenceMonth}
            onChange={(value) => pushParams({ referenceMonth: value || null })}
          />
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Mês</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead className="text-right">Valor mensal</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground">
                  Nenhum grupo encontrado.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <TableRow key={group.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{group.name}</span>
                      {group.description ? (
                        <span className="text-xs text-muted-foreground">
                          {group.description}
                        </span>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{group.referenceMonth}</Badge>
                  </TableCell>
                  <TableCell>
                    <span
                      className="inline-block size-4 rounded-full border border-border"
                      style={{ backgroundColor: group.color }}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {currencyFormatter.format(group.monthlyAmount)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm text-muted-foreground">
            {total} grupo(s) encontrados
          </span>

          <Pagination className="sm:justify-end">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href={buildPageHref(Math.max(1, page - 1))}
                  className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                />
              </PaginationItem>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((p) => (
                <PaginationItem key={p}>
                  <PaginationLink href={buildPageHref(p)} isActive={p === page}>
                    {p}
                  </PaginationLink>
                </PaginationItem>
              ))}
              <PaginationItem>
                <PaginationNext
                  href={buildPageHref(Math.min(totalPages, page + 1))}
                  className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </CardContent>
    </Card>
  );
}
