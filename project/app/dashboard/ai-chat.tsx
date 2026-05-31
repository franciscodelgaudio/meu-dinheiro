"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageCircle, Send, Loader2, Sparkles, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const USAGE_MARKER = "\x00__USAGE__";
const GEMINI_CONTEXT_LIMIT = 1_048_576;
const BASE_RETRY_SECONDS = 60;
const MAX_RETRY_SECONDS = 300;

type TokenUsage = { p: number; r: number; t: number };

type Message = {
  role: "user" | "model";
  text: string;
  streaming?: boolean;
  tokens?: TokenUsage;
  errorType?: "rate_limit" | "general";
};

const SUGGESTED_QUESTIONS = [
  "Quanto devo gastar com lazer hoje?",
  "Estou dentro do orcamento esse mes?",
  "Qual grupo esta mais estourado?",
  "Quanto ja gastei esse mes?",
  "Quanto tenho disponivel ainda?",
];

function TokenIndicator({ used, limit }: { used: number; limit: number }) {
  const remaining = limit - used;
  const percent = Math.min((used / limit) * 100, 100);
  const color =
    percent >= 80 ? "bg-red-500" : percent >= 50 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1 w-20 overflow-hidden rounded-full bg-zinc-200">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-[10px] text-zinc-400">
        {remaining.toLocaleString("pt-BR")} tokens restantes
      </span>
    </div>
  );
}

export function AiChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [totalTokensUsed, setTotalTokensUsed] = useState(0);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rateLimitHitsRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const startCountdown = useCallback((seconds: number) => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    setRetryCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setRetryCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading || retryCountdown > 0) return;

      const trimmed = text.trim();
      const currentHistory = messages.map((m) => ({ role: m.role, text: m.text }));

      setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
      setInput("");
      setLoading(true);
      setMessages((prev) => [...prev, { role: "model", text: "", streaming: true }]);

      try {
        const res = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed, history: currentHistory }),
        });

        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Erro desconhecido" }));

          if (res.status === 429) {
            rateLimitHitsRef.current += 1;
            const base = Math.max(err.retryAfter ?? 0, BASE_RETRY_SECONDS);
            const wait = Math.min(base * rateLimitHitsRef.current, MAX_RETRY_SECONDS);
            startCountdown(wait);
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = {
                role: "model",
                text: "",
                streaming: false,
                errorType: "rate_limit",
              };
              return updated;
            });
            return;
          }

          throw new Error(err.error ?? "Erro ao conectar com o assistente.");
        }

        // Successful request resets the backoff counter
        rateLimitHitsRef.current = 0;

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullText += decoder.decode(value, { stream: true });
          const markerIdx = fullText.indexOf(USAGE_MARKER);
          const displayText = markerIdx !== -1 ? fullText.slice(0, markerIdx) : fullText;
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "model", text: displayText, streaming: true };
            return updated;
          });
        }

        const markerIdx = fullText.indexOf(USAGE_MARKER);
        let displayText = fullText;
        let tokens: TokenUsage | undefined;
        if (markerIdx !== -1) {
          displayText = fullText.slice(0, markerIdx);
          try {
            tokens = JSON.parse(fullText.slice(markerIdx + USAGE_MARKER.length)) as TokenUsage;
          } catch {
            // ignore parse errors
          }
        }

        if (tokens) {
          setTotalTokensUsed((prev) => prev + tokens!.r);
        }

        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "model", text: displayText, streaming: false, tokens };
          return updated;
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Nao consegui responder agora. Tente novamente.";
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "model",
            text: errorMessage,
            streaming: false,
            errorType: "general",
          };
          return updated;
        });
      } finally {
        setLoading(false);
      }
    },
    [loading, messages, retryCountdown, startCountdown],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  const blocked = loading || retryCountdown > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-lg transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
        aria-label="Abrir assistente financeiro"
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="flex w-full flex-col gap-0 p-0 sm:max-w-md"
          showCloseButton={false}
        >
          <SheetHeader className="flex-row items-center justify-between border-b px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <SheetTitle className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                Assistente Financeiro
              </SheetTitle>
              {totalTokensUsed > 0 && (
                <TokenIndicator used={totalTokensUsed} limit={GEMINI_CONTEXT_LIMIT} />
              )}
            </div>
            <div className="flex items-center gap-2">
              {messages.length > 0 && (
                <button
                  onClick={() => {
                    setMessages([]);
                    setTotalTokensUsed(0);
                    rateLimitHitsRef.current = 0;
                  }}
                  className="text-xs text-zinc-400 hover:text-zinc-600"
                  disabled={loading}
                >
                  Limpar
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <p className="text-center text-sm text-zinc-500">
                  Ola! Pergunte sobre suas financas.
                </p>
                <div className="space-y-2">
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-50 hover:border-zinc-300"
                      disabled={blocked}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                        msg.role === "user"
                          ? "bg-emerald-600 text-white"
                          : msg.errorType === "rate_limit"
                          ? "border border-amber-200 bg-amber-50 text-amber-900"
                          : msg.errorType === "general"
                          ? "border border-red-200 bg-red-50 text-red-900"
                          : "bg-zinc-100 text-zinc-900"
                      } ${!msg.errorType ? "whitespace-pre-wrap" : ""}`}
                    >
                      {msg.errorType === "rate_limit" ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                            <span className="font-medium">Limite de requisições atingido</span>
                          </div>
                          {retryCountdown > 0 ? (
                            <p className="text-xs text-amber-700">
                              Disponível em{" "}
                              <span className="font-semibold tabular-nums">{retryCountdown}s</span>
                            </p>
                          ) : (
                            <p className="text-xs text-amber-700">Você já pode tentar novamente.</p>
                          )}
                          {totalTokensUsed > 0 && (
                            <p className="text-xs text-amber-600/80">
                              {totalTokensUsed.toLocaleString("pt-BR")} tokens usados nesta sessão
                            </p>
                          )}
                        </div>
                      ) : msg.errorType === "general" ? (
                        <div className="flex items-start gap-1.5">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" />
                          <span>{msg.text}</span>
                        </div>
                      ) : msg.text ? (
                        msg.text
                      ) : (
                        msg.streaming && (
                          <span className="flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                              <span className="h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
                            </span>
                            <span className="animate-pulse text-xs text-zinc-400">Pensando...</span>
                          </span>
                        )
                      )}
                    </div>
                    {msg.role === "model" && msg.tokens && !msg.streaming && (
                      <span className="mt-1 text-[10px] text-zinc-400">
                        {msg.tokens.p.toLocaleString("pt-BR")} entrada ·{" "}
                        {msg.tokens.r.toLocaleString("pt-BR")} saída ·{" "}
                        {msg.tokens.t.toLocaleString("pt-BR")} total
                      </span>
                    )}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="border-t p-4">
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pergunte sobre suas financas..."
                className="min-h-[44px] max-h-[120px] resize-none text-sm"
                disabled={blocked}
                rows={1}
              />
              <Button
                onClick={() => sendMessage(input)}
                disabled={!input.trim() || blocked}
                size="icon"
                className="shrink-0 bg-emerald-600 hover:bg-emerald-700"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            {retryCountdown > 0 ? (
              <p className="mt-1.5 text-xs font-medium text-amber-600">
                Aguarde {retryCountdown}s para enviar novamente...
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-zinc-400">
                Enter para enviar · Shift+Enter para nova linha
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
