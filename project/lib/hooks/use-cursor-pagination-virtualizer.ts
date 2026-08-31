import { useEffect, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export type CursorPage<T> = {
  data: T[];
  hasNextPage: boolean;
  nextCursor: string | null;
};

type UseCursorPaginationVirtualizerOptions<T> = {
  fetchPage: (cursor?: string) => Promise<CursorPage<T>>;
  estimateSize: number;
  overscan?: number;
  // Reinicia a lista do zero (equivalente a chamar fetchPage sem cursor)
  // sempre que um valor desta lista mudar, ex.: o id da entidade da página.
  deps?: unknown[];
};

export function useCursorPaginationVirtualizer<T>({
  fetchPage,
  estimateSize,
  overscan = 10,
  deps = [],
}: UseCursorPaginationVirtualizerOptions<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [scrollMargin, setScrollMargin] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  // Estado só é atualizado de forma assíncrona, então dois disparos do efeito
  // de scroll no mesmo tick (ex.: StrictMode) ainda veriam status "idle" e
  // duplicariam o fetch; a ref é atualizada na hora e evita a corrida.
  const isFetchingRef = useRef(false);
  const fetchPageRef = useRef(fetchPage);
  fetchPageRef.current = fetchPage;

  async function loadPage(nextCursor?: string) {
    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;
    setStatus("loading");
    try {
      const page = await fetchPageRef.current(nextCursor);
      setItems((prev) => (nextCursor ? [...prev, ...page.data] : page.data));
      setCursor(page.nextCursor);
      setHasNextPage(page.hasNextPage);
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
  }, deps);

  // Quando há conteúdo acima da lista dentro da mesma área de scroll (ex.:
  // um cabeçalho de página), o virtualizador precisa saber quantos pixels
  // existem antes dela para calcular as posições certas.
  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) {
      setScrollMargin(0);
      return;
    }
    const updateMargin = () => setScrollMargin(headerEl.offsetHeight);
    updateMargin();
    const observer = new ResizeObserver(updateMargin);
    observer.observe(headerEl);
    return () => observer.disconnect();
  }, []);

  const rowVirtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => estimateSize,
    overscan,
    scrollMargin,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  // Dispara o carregamento da próxima página assim que a última linha
  // renderizada (dentro do overscan) alcança o fim dos dados já buscados.
  useEffect(() => {
    const lastItem = virtualItems[virtualItems.length - 1];
    if (!lastItem || isFetchingRef.current || !hasNextPage || !cursor) {
      return;
    }
    if (lastItem.index >= items.length - 1) {
      loadPage(cursor);
    }
  }, [virtualItems, items.length, hasNextPage, status, cursor]);

  return {
    items,
    status,
    scrollRef,
    headerRef,
    rowVirtualizer,
    virtualItems,
    reload: () => loadPage(),
  };
}
