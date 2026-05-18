import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { geminiModel } from "@/lib/gemini";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Calendar, Lightbulb, ShieldAlert } from "lucide-react";

type InsightsData = {
  riskLevel: "low" | "medium" | "high" | "critical";
  riskAlert: string | null;
  criticalGroups: Array<{ name: string; reason: string; severity: "warning" | "critical" }>;
  weekendAdvice: string;
  leisureBudget: number;
  recommendations: string[];
};

function getDaysUntilPayday(paydayStart: number | null, today: Date): number {
  const y = today.getUTCFullYear();
  const m = today.getUTCMonth();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  const payday = paydayStart ?? lastDay;

  let next = new Date(Date.UTC(y, m, Math.min(payday, lastDay)));
  if (next <= today) {
    const lastDayNext = new Date(Date.UTC(y, m + 2, 0)).getUTCDate();
    next = new Date(Date.UTC(y, m + 1, Math.min(payday, lastDayNext)));
  }

  return Math.max(1, Math.ceil((next.getTime() - today.getTime()) / 86400000));
}

function getNextWeekendLabel(today: Date): string {
  const dow = today.getUTCDay();
  const daysUntil = dow === 0 ? 6 : 6 - dow;
  const saturday = new Date(today.getTime() + daysUntil * 86400000);
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone: "UTC",
  }).format(saturday);
}

function getMonthRange(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export async function FinancialInsights({ selectedMonth }: { selectedMonth: string }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const monthRange = getMonthRange(selectedMonth);

  const [financeProfile, extraIncomes, savingsAllocation, expenseGroups] =
    await Promise.all([
      prisma.userFinanceProfile.findUnique({
        where: { userId: user.id },
        select: { monthlyIncome: true, paydayStart: true, currency: true },
      }),
      prisma.extraIncome.findMany({
        where: { userId: user.id, referenceMonth: selectedMonth },
        select: { amount: true },
      }),
      prisma.savingsAllocation.findUnique({
        where: { userId_referenceMonth: { userId: user.id, referenceMonth: selectedMonth } },
        select: { amount: true },
      }),
      prisma.expenseGroup.findMany({
        where: {
          userId: user.id,
          OR: [
            { referenceMonth: selectedMonth },
            { affectsFutureMonths: true, referenceMonth: { lt: selectedMonth } },
          ],
        },
        include: {
          overrides: {
            where: { userId: user.id, referenceMonth: selectedMonth },
            take: 1,
          },
          expenses: {
            where: { spentAt: { gte: monthRange.start, lt: monthRange.end } },
            select: { amount: true },
          },
        },
      }),
    ]);

  const today = new Date();
  const currency = financeProfile?.currency ?? "BRL";
  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency });

  const baseIncome = Number(financeProfile?.monthlyIncome ?? 0);
  const extraIncome = extraIncomes.reduce((s, e) => s + Number(e.amount), 0);
  const totalIncome = baseIncome + extraIncome;
  const totalSavings = Number(savingsAllocation?.amount ?? 0);
  const daysUntilPayday = getDaysUntilPayday(financeProfile?.paydayStart ?? null, today);
  const nextWeekend = getNextWeekendLabel(today);

  const groups = expenseGroups
    .filter((g) => {
      const planned = Number(g.overrides[0]?.monthlyAmount ?? g.monthlyAmount);
      const spent = g.expenses.reduce((s, e) => s + Number(e.amount), 0);
      return planned > 0 || spent > 0;
    })
    .map((g) => ({
      name: (g.overrides[0]?.name ?? g.name),
      planned: Number(g.overrides[0]?.monthlyAmount ?? g.monthlyAmount),
      spent: g.expenses.reduce((s, e) => s + Number(e.amount), 0),
    }));

  const totalPlanned = groups.reduce((s, g) => s + g.planned, 0);
  const totalSpent = groups.reduce((s, g) => s + g.spent, 0);
  const totalRemaining = totalIncome - totalSpent;
  const sustainableDaily = daysUntilPayday > 0 ? totalRemaining / daysUntilPayday : 0;
  const committedPct = totalIncome > 0 ? ((totalPlanned + totalSavings) / totalIncome) * 100 : 0;

  const groupsText = groups
    .map((g) => {
      const pct = g.planned > 0 ? ((g.spent / g.planned) * 100).toFixed(0) : "—";
      return `- ${g.name}: planejado ${fmt.format(g.planned)}, gasto ${fmt.format(g.spent)} (${pct}% do planejado)`;
    })
    .join("\n");

  const prompt = `Você é um assistente financeiro pessoal direto e prático. Analise os dados financeiros e responda APENAS com JSON válido, sem markdown, sem texto extra.

Data atual: ${today.toLocaleDateString("pt-BR")}
Próximo fim de semana: ${nextWeekend}
Dias até receber: ${daysUntilPayday}
Mês de referência: ${selectedMonth}

RENDA:
- Base mensal: ${fmt.format(baseIncome)}
- Extra do mês: ${fmt.format(extraIncome)}
- Total: ${fmt.format(totalIncome)}

COMPROMETIMENTO:
- Gastos planejados: ${fmt.format(totalPlanned)} (${committedPct.toFixed(1)}% da renda)
- Poupança: ${fmt.format(totalSavings)}
- Sobra planejada: ${fmt.format(totalIncome - totalPlanned - totalSavings)}

SITUAÇÃO REAL ATÉ HOJE:
- Gasto registrado: ${fmt.format(totalSpent)}
- Restante real: ${fmt.format(totalRemaining)}
- Ritmo sustentável: ${fmt.format(sustainableDaily)}/dia

GRUPOS:
${groupsText || "Nenhum grupo cadastrado."}

Responda SOMENTE com este JSON (sem markdown, sem \`\`\`):
{
  "riskLevel": "low" ou "medium" ou "high" ou "critical",
  "riskAlert": "mensagem curta de alerta ou null se situação estiver ok",
  "criticalGroups": [{"name": "nome", "reason": "motivo em 1 frase curta", "severity": "warning" ou "critical"}],
  "weekendAdvice": "conselho prático e direto sobre sair no fim de semana (máx 2 frases)",
  "leisureBudget": 0.0,
  "recommendations": ["recomendacao 1", "recomendacao 2", "recomendacao 3"]
}`;

  let insights: InsightsData = {
    riskLevel: "low",
    riskAlert: null,
    criticalGroups: [],
    weekendAdvice: "Não foi possível gerar recomendação agora.",
    leisureBudget: 0,
    recommendations: ["Configure a variável GEMINI_API_KEY para ativar os insights de IA."],
  };

  try {
    const cachedGenerate = unstable_cache(
      async (p: string) => {
        const result = await geminiModel.generateContent(p);
        return result.response.text().trim().replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
      },
      ["gemini-insights", user.id, selectedMonth],
      { revalidate: 86400 },
    );
    const raw = await cachedGenerate(prompt);
    insights = JSON.parse(raw);
  } catch (err) {
    console.error("[FinancialInsights] Gemini error:", err);
  }

  const riskBg: Record<string, string> = {
    low: "bg-emerald-50 border-emerald-200 text-emerald-900",
    medium: "bg-yellow-50 border-yellow-200 text-yellow-900",
    high: "bg-orange-50 border-orange-200 text-orange-900",
    critical: "bg-red-50 border-red-200 text-red-900",
  };

  const riskLabel: Record<string, string> = {
    low: "Situação segura",
    medium: "Atenção",
    high: "Risco",
    critical: "Crítico",
  };

  return (
    <div className="grid gap-4">
      {insights.riskAlert && (
        <div className={`flex items-start gap-3 rounded-lg border p-4 ${riskBg[insights.riskLevel]}`}>
          <ShieldAlert className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">{riskLabel[insights.riskLevel]}</p>
            <p className="mt-1 text-sm">{insights.riskAlert}</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between gap-2 text-base">
              <span className="flex items-center gap-2">
                <Calendar className="size-4 text-muted-foreground" />
                Fim de semana
              </span>
              {insights.leisureBudget > 0 && (
                <Badge variant="secondary">
                  até {fmt.format(insights.leisureBudget)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{insights.weekendAdvice}</p>
          </CardContent>
        </Card>

        {insights.criticalGroups.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Grupos críticos</CardTitle>
              <CardDescription>
                {insights.criticalGroups.length} grupo(s) precisam de atenção
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {insights.criticalGroups.map((g, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle
                    className={`mt-0.5 size-4 shrink-0 ${
                      g.severity === "critical" ? "text-red-600" : "text-yellow-500"
                    }`}
                  />
                  <div>
                    <p className="text-sm font-medium">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{g.reason}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Lightbulb className="size-4 text-yellow-500" />
            Recomendações da IA
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2">
          {insights.recommendations.map((rec, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="mt-[7px] size-1.5 shrink-0 rounded-full bg-muted-foreground" />
              <p className="text-sm text-muted-foreground">{rec}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export function FinancialInsightsSkeleton() {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        {[0, 1].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="h-5 w-36 animate-pulse rounded bg-muted" />
            </CardHeader>
            <CardContent className="grid gap-2">
              <div className="h-4 w-full animate-pulse rounded bg-muted" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
        </CardHeader>
        <CardContent className="grid gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-4 w-full animate-pulse rounded bg-muted" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
