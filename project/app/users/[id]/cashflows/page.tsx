"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CreateCashflowSheet } from "@/components/cashflows/create-cashflow-sheet";

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

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const GRID_COLUMNS = "2fr 1fr 1fr 1fr";
const ROW_HEIGHT = 44;
const PAGE_SIZE = 10;

export default function CashflowsPage() {
  const { id: userId } = useParams<{ id: string }>();
  const [cashflows, setCashflows] = useState<Cashflow[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  // Estado só é atualizado de forma assíncrona, então dois disparos do efeito
  // de scroll no mesmo tick (ex.: StrictMode) ainda veriam status "idle" e
  // duplicariam o fetch; a ref é atualizada na hora e evita a corrida.
  const isFetchingRef = useRef(false);

  async function loadPage(nextCursor?: string) {
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;
    setStatus("loading");
    try {
      const url = new URL(`/api/v1/user/${userId}/cashflow`, window.location.origin);
      url.searchParams.set("limit", String(PAGE_SIZE));
      if (nextCursor) {
        url.searchParams.set("cursor", nextCursor);
      }

      const response = await fetch(url);
      const data: CashflowListResponse = await response.json();

      if (!response.ok) {
        throw new Error("Failed to load cashflows");
      }

      setCashflows((prev) => (nextCursor ? [...prev, ...data.data] : data.data));
      setCursor(data.nextCursor);
      setHasNextPage(data.hasNextPage);
      setStatus("idle");
    } catch {
      setStatus("error");
    } finally {
      isFetchingRef.current = false;
    }
  }

  useEffect(() => {
    loadPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const rowVirtualizer = useVirtualizer({
    count: cashflows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Dispara o carregamento da próxima página assim que a última linha
  // renderizada (dentro do overscan) alcança o fim dos dados já buscados.
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem || isFetchingRef.current || !hasNextPage || !cursor) {
      return;
    }
    if (lastItem.index >= cashflows.length - 1) {
      loadPage(cursor);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [virtualItems, cashflows.length, hasNextPage, status, cursor]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <Card className="flex min-h-0 flex-1 flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Lançamentos</CardTitle>
            <CardDescription className="break-all">
              Entradas e saídas do usuário {userId}.
            </CardDescription>
          </div>
          <CreateCashflowSheet userId={userId} onCreated={() => loadPage()} />
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col">
          {status === "error" && (
            <p className="text-sm text-destructive">Erro ao carregar lançamentos.</p>
          )}
          {status !== "error" && cashflows.length === 0 && status === "idle" && (
            <p className="text-sm text-muted-foreground">Nenhum lançamento encontrado.</p>
          )}
          {cashflows.length > 0 && (
            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto rounded-md border">
              <Table style={{ display: "grid" }}>
                <TableHeader
                  className="sticky top-0 z-10 bg-muted/95"
                  style={{ display: "grid" }}
                >
                  <TableRow className="hover:bg-transparent" style={{ display: "grid", gridTemplateColumns: GRID_COLUMNS }}>
                    <TableHead>Nome</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
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
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        <TableCell className="truncate">{cashflow.name}</TableCell>
                        <TableCell>
                          {new Date(cashflow.date).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={cashflow.type === "income" ? "default" : "destructive"}>
                            {cashflow.type === "income" ? "Entrada" : "Saída"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {currencyFormatter.format(cashflow.total)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
