import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { geminiModel } from "@/lib/gemini";

interface ChatMessage {
  role: "user" | "model";
  text: string;
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

  const expenses = await prisma.expense.findMany({
    where: {
      userId: user.id,
      spentAt: { gte: startOfMonth, lte: endOfMonth },
    },
    select: {
      title: true,
      amount: true,
      spentAt: true,
      behaviorType: true,
      expenseGroup: { select: { id: true, name: true } },
    },
    orderBy: { spentAt: "desc" },
  });

  const groups = rawGroups.map((group) => {
    const override = group.overrides[0];
    const name = override?.name ?? group.name;
    const budget = Number(override?.monthlyAmount ?? group.monthlyAmount);
    const groupExpenses = expenses.filter((e) => e.expenseGroup.id === group.id);
    const spent = groupExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const remaining = budget - spent;
    const percentUsed = budget > 0 ? Math.round((spent / budget) * 100) : 0;
    const dailyAllowance = daysRemaining > 0 && remaining > 0 ? remaining / daysRemaining : 0;

    return {
      name,
      budget,
      spent,
      remaining,
      percentUsed,
      dailyAllowance,
      expenses: groupExpenses.slice(0, 8).map((e) => ({
        title: e.title,
        amount: Number(e.amount),
        date: e.spentAt.toISOString().split("T")[0],
      })),
      expenseCount: groupExpenses.length,
    };
  });

  const monthlyIncome = Number(profile?.monthlyIncome ?? 0);
  const extraTotal = extraIncomes.reduce((sum, e) => sum + Number(e.amount), 0);
  const savingsGoal = Number(savings?.amount ?? 0);
  const totalIncome = monthlyIncome + extraTotal;
  const totalPlanned = groups.reduce((sum, g) => sum + g.budget, 0);
  const totalSpent = groups.reduce((sum, g) => sum + g.spent, 0);
  const availableBalance = totalIncome - totalPlanned - savingsGoal;
  const budgetUsagePercent = totalPlanned > 0 ? Math.round((totalSpent / totalPlanned) * 100) : 0;

  const systemPrompt = `Voce e o assistente financeiro pessoal de ${user.name ?? "usuario"}.
Responda sempre em portugues brasileiro de forma objetiva, amigavel e direta.
Use os dados abaixo para responder perguntas sobre financas. Nunca invente dados.

=== DADOS FINANCEIROS - ${referenceMonth} ===

Hoje: ${todayStr} (dia ${dayOfMonth} de ${daysInMonth}, restam ${daysRemaining} dias no mes incluindo hoje)

RENDA:
- Renda mensal: ${formatBRL(monthlyIncome)}${extraIncomes.length > 0 ? `\n- Rendas extras: ${extraIncomes.map((e) => `${e.name} ${formatBRL(Number(e.amount))}`).join(", ")}` : ""}
- Total de renda: ${formatBRL(totalIncome)}

POUPANCA META: ${formatBRL(savingsGoal)}
SALDO DISPONIVEL (renda - planejado - poupanca): ${formatBRL(availableBalance)}${profile?.paydayStart ? `\nDIA DE PAGAMENTO: entre dia ${profile.paydayStart} e dia ${profile.paydayEnd ?? profile.paydayStart}` : ""}

GRUPOS DE DESPESAS:
${groups
  .map(
    (g) =>
      `[${g.name}] orcamento ${formatBRL(g.budget)} | gasto ${formatBRL(g.spent)} (${g.percentUsed}%) | restante ${formatBRL(g.remaining)} | media diaria disponivel: ${formatBRL(g.dailyAllowance)}/dia${
        g.expenses.length > 0
          ? `\n  Ultimos gastos: ${g.expenses.map((e) => `${e.title} ${formatBRL(e.amount)} em ${e.date}`).join("; ")}${g.expenseCount > 8 ? ` e mais ${g.expenseCount - 8} gastos` : ""}`
          : "\n  Sem gastos registrados"
      }`,
  )
  .join("\n")}

RESUMO: ${formatBRL(totalSpent)} gastos de ${formatBRL(totalPlanned)} planejados (${budgetUsagePercent}% do orcamento)
${profile?.notes ? `\nNOTAS: ${profile.notes}` : ""}
=== FIM DOS DADOS ===

Dicas:
- Para "quanto devo gastar hoje" com um grupo: use o campo "media diaria disponivel" do grupo
- Se um grupo estiver acima de 80% do orcamento, mencione como alerta
- Seja conciso. Use listas curtas quando listar varios itens`;

  const chatHistory = history.map((msg) => ({
    role: msg.role as "user" | "model",
    parts: [{ text: msg.text }],
  }));

  try {
    const chat = geminiModel.startChat({
      history: chatHistory,
      systemInstruction: systemPrompt,
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
  } catch {
    return NextResponse.json(
      { error: "Erro ao processar sua pergunta. Tente novamente." },
      { status: 500 },
    );
  }
}
