import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { geminiModel } from "@/lib/gemini";

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

// Server-side throttle: max 1 request per 7s per user (~8/min, under the 10 RPM free-tier limit)
const THROTTLE_MS = 7000;
const userLastRequest = new Map<string, number>();

function checkThrottle(userId: string): number {
  const last = userLastRequest.get(userId) ?? 0;
  const elapsed = Date.now() - last;
  if (elapsed < THROTTLE_MS) {
    return Math.ceil((THROTTLE_MS - elapsed) / 1000);
  }
  userLastRequest.set(userId, Date.now());
  return 0;
}

function extractRetryDelay(error: unknown): number | null {
  if (!(error instanceof Error)) return null;
  const details = (error as { errorDetails?: unknown[] }).errorDetails;
  if (Array.isArray(details)) {
    for (const detail of details) {
      const d = detail as Record<string, unknown>;
      if (typeof d?.retryDelay === "string") {
        const match = d.retryDelay.match(/^(\d+)s$/);
        if (match) return parseInt(match[1], 10);
      }
    }
  }
  const match = error.message.match(/retryDelay["\s:]+(\d+)s/i);
  if (match) return parseInt(match[1], 10);
  return null;
}

function getReferenceMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 });
  }

  const body = await req.json();
  const message: string = body.message ?? "";
  const history: ChatMessage[] = body.history ?? [];

  if (!message.trim()) {
    return NextResponse.json({ error: "Mensagem vazia" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, name: true },
  });

  if (!user) {
    return NextResponse.json({ error: "Usuario nao encontrado" }, { status: 404 });
  }

  const throttleWait = checkThrottle(user.id);
  if (throttleWait > 0) {
    return NextResponse.json({ error: "rate_limit", retryAfter: throttleWait }, { status: 429 });
  }

  const referenceMonth = getReferenceMonth();
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const dayOfMonth = now.getDate();
  const daysRemaining = daysInMonth - dayOfMonth + 1;

  const [profile, rawGroups, extraIncomes, savings] = await Promise.all([
    prisma.userFinanceProfile.findUnique({
      where: { userId: user.id },
      select: { monthlyIncome: true, paydayStart: true, paydayEnd: true, notes: true },
    }),
    prisma.expenseGroup.findMany({
      where: {
        userId: user.id,
        OR: [
          { referenceMonth },
          { affectsFutureMonths: true, referenceMonth: { lt: referenceMonth } },
        ],
      },
      include: {
        overrides: {
          where: { userId: user.id, referenceMonth },
          take: 1,
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
    prisma.extraIncome.findMany({
      where: { userId: user.id, referenceMonth },
      select: { name: true, amount: true },
    }),
    prisma.savingsAllocation.findUnique({
      where: { userId_referenceMonth: { userId: user.id, referenceMonth } },
      select: { amount: true },
    }),
  ]);

  const startOfMonth = new Date(`${referenceMonth}-01T00:00:00.000Z`);
  const endOfMonth = new Date(
    `${referenceMonth}-${String(daysInMonth).padStart(2, "0")}T23:59:59.999Z`,
  );

  const spentPerGroup = await prisma.expense.groupBy({
    by: ["expenseGroupId"],
    where: {
      userId: user.id,
      spentAt: { gte: startOfMonth, lte: endOfMonth },
    },
    _sum: { amount: true },
  });

  const spentMap = new Map(
    spentPerGroup.map((r) => [r.expenseGroupId, Number(r._sum.amount ?? 0)]),
  );

  const groups = rawGroups.map((group) => {
    const override = group.overrides[0];
    const name = override?.name ?? group.name;
    const budget = Number(override?.monthlyAmount ?? group.monthlyAmount);
    const spent = spentMap.get(group.id) ?? 0;
    const remaining = budget - spent;
    const percentUsed = budget > 0 ? Math.round((spent / budget) * 100) : 0;
    const dailyAllowance = daysRemaining > 0 && remaining > 0 ? remaining / daysRemaining : 0;

    return { name, budget, spent, remaining, percentUsed, dailyAllowance };
  });

  const monthlyIncome = Number(profile?.monthlyIncome ?? 0);
  const extraTotal = extraIncomes.reduce((sum, e) => sum + Number(e.amount), 0);
  const savingsGoal = Number(savings?.amount ?? 0);
  const totalIncome = monthlyIncome + extraTotal;
  const totalPlanned = groups.reduce((sum, g) => sum + g.budget, 0);
  const totalSpent = groups.reduce((sum, g) => sum + g.spent, 0);
  // Dinheiro real restante = renda - tudo que já foi gasto - poupança
  const realRemaining = totalIncome - totalSpent - savingsGoal;
  // Saldo não alocado = renda - total planejado (ignora gasto real, útil só para planejamento)
  const unallocatedBalance = totalIncome - totalPlanned - savingsGoal;
  const budgetUsagePercent = totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0;

  const groupLines = groups
    .map((g) => `${g.name}: orc ${formatBRL(g.budget)} gasto ${formatBRL(g.spent)} (${g.percentUsed}%) sobra ${formatBRL(g.remaining)} ~${formatBRL(g.dailyAllowance)}/dia`)
    .join("\n");

  const systemPrompt = `Voce e o assistente financeiro pessoal de ${user.name ?? "usuario"}. Responda em PT-BR. Nunca invente dados.

=== SITUACAO FINANCEIRA - ${referenceMonth} ===
Hoje: ${todayStr} | Dia ${dayOfMonth} de ${daysInMonth} | ${daysRemaining} dia(s) restantes no mes${profile?.paydayStart ? ` | Proximo pagamento: dia ${profile.paydayStart}${profile.paydayEnd ? `-${profile.paydayEnd}` : ""}` : ""}

Renda total do mes: ${formatBRL(totalIncome)}${extraIncomes.length > 0 ? ` (base ${formatBRL(monthlyIncome)} + extras ${formatBRL(extraTotal)})` : ""}
Poupanca meta: ${formatBRL(savingsGoal)}
Total ja gasto: ${formatBRL(totalSpent)} de ${formatBRL(totalPlanned)} orcados (${budgetUsagePercent}% do orcamento)

DINHEIRO REAL DISPONIVEL: ${formatBRL(realRemaining)}
(= renda ${formatBRL(totalIncome)} - gasto real ${formatBRL(totalSpent)} - poupanca ${formatBRL(savingsGoal)})
${realRemaining < 0 ? `⚠️ ATENCAO: o usuario JA GASTOU MAIS do que recebeu este mes (deficit de ${formatBRL(Math.abs(realRemaining))})` : ""}

Saldo nao alocado (apenas para planejamento, NAO e dinheiro disponivel): ${formatBRL(unallocatedBalance)}
${profile?.notes ? `Notas do usuario: ${profile.notes}` : ""}

GRUPOS (orcado | gasto | sobra do orcamento):
${groupLines}

=== COMO RACIOCINAR ===
- "Quanto posso gastar" ou "qual meu limite": use DINHEIRO REAL DISPONIVEL, nunca o saldo nao alocado
- Se o dinheiro disponivel for baixo: diga o valor real, explique que ha ${daysRemaining} dia(s) ate o proximo pagamento, e sugira um valor proporcional considerando necessidades basicas ainda pendentes (alimentacao, transporte)
- Se ja estiver no deficit: seja honesto, explique que o usuario ja gastou mais do que ganhou
- Quando sugerir um limite de lazer: considere que o usuario ainda precisa de dinheiro para comer e se locomover nos ${daysRemaining} dia(s) restantes
- Seja pratico e humano: nao apenas diga "nao gaste", sugira alternativas ou um valor seguro real`;

  const chatHistory = history.map((msg) => ({
    role: msg.role as "user" | "model",
    parts: [{ text: msg.text }],
  }));

  try {
    const chat = geminiModel.startChat({
      history: chatHistory,
      systemInstruction: {
        role: "user",
        parts: [{ text: systemPrompt }],
      },
    });

    const result = await chat.sendMessageStream(message.trim());

    const encoder = new TextEncoder();
    const USAGE_MARKER = "\x00__USAGE__";

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
          const response = await result.response;
          const usage = response.usageMetadata;
          if (usage) {
            controller.enqueue(
              encoder.encode(
                `${USAGE_MARKER}${JSON.stringify({
                  p: usage.promptTokenCount ?? 0,
                  r: usage.candidatesTokenCount ?? 0,
                  t: usage.totalTokenCount ?? 0,
                })}`,
              ),
            );
          }
        } catch (streamError) {
          console.error("[ai-chat] stream error:", streamError);
          const msg = streamError instanceof Error ? streamError.message : String(streamError);
          controller.enqueue(encoder.encode(`\n\n_Erro: ${msg}_`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    const details = (error as { errorDetails?: unknown[] }).errorDetails;
    console.error("[ai-chat] error msg:", msg);
    console.error("[ai-chat] error details:", JSON.stringify(details ?? null));

    const isRateLimit =
      msg.includes("[429") ||
      msg.toLowerCase().includes("too many requests") ||
      msg.toLowerCase().includes("quota exceeded") ||
      msg.toLowerCase().includes("resource_exhausted");
    const isSafety =
      msg.toLowerCase().includes("safety") || msg.toLowerCase().includes("block");

    if (isRateLimit) {
      const isDaily =
        msg.toLowerCase().includes("per_day") ||
        msg.toLowerCase().includes("daily") ||
        msg.toLowerCase().includes("requests_per_day");
      if (isDaily) {
        return NextResponse.json(
          { error: "Limite diario da API do Gemini atingido. Tente novamente amanha (meia-noite UTC)." },
          { status: 429 },
        );
      }
      const suggested = extractRetryDelay(error) ?? 0;
      const retryAfter = Math.max(suggested, 60);
      return NextResponse.json({ error: "rate_limit", retryAfter, geminiMsg: msg.slice(0, 300) }, { status: 429 });
    }

    const userMessage = isSafety
      ? "Mensagem bloqueada por filtro de seguranca. Tente reformular."
      : `Erro Gemini: ${msg.slice(0, 200)}`;

    return NextResponse.json({ error: userMessage }, { status: 500 });
  }
}
