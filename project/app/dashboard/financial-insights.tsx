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
import { getPaydayMonthRange } from "@/lib/date-utils";

type InsightsData = {
  riskLevel: "low" | "medium" | "high" | "critical";
  riskAlert: string | null;
  criticalGroups: Array<{ name: string; reason: string; severity: "warning" | "critical" }>;
  weekendAdvice: string;
  leisureBudget: number;
  recommendations: string[];
  currency: string;
};


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

// Defined OUTSIDE the component so the cache persists across renders.
// Cache key = (userId, selectedMonth, todayStr) — stable within the same day.
// Tag "financial-insights" allows invalidation when expenses change.
const getCachedInsights = unstable_cache(
  async (userId: string, selectedMonth: string, todayStr: string): Promise<InsightsData> => {
    const today = new Date(todayStr + "T12:00:00Z");

    const financeProfile = await prisma.userFinanceProfile.findUnique({
      where: { userId },
      select: { currency: true, paydayStart: true },
    });

    const currency = financeProfile?.currency ?? "BRL";
    const monthRange = getPaydayMonthRange(selectedMonth, financeProfile?.paydayStart ?? null);

    const expenseGroups = await prisma.expenseGroup.findMany({
      where: {
        userId,
        OR: [
          { referenceMonth: selectedMonth },
          { affectsFutureMonths: true, referenceMonth: { lt: selectedMonth } },
        ],
      },
      include: {
        overrides: {
          where: { userId, referenceMonth: selectedMonth },
          take: 1,
        },
        expenses: {
          where: { spentAt: { gte: monthRange.start, lt: monthRange.end } },
          select: { amount: true },
        },
      },
    });

    const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency });
    const nextWeekend = getNextWeekendLabel(today);

    const groups = expenseGroups
      .filter((g) => {
        const planned = Number(g.overrides[0]?.monthlyAmount ?? g.monthlyAmount);
        const spent = g.expenses.reduce((s, e) => s + Number(e.amount), 0);
        return planned > 0 || spent > 0;
      })
      .map((g) => ({
        name: g.overrides[0]?.name ?? g.name,
        planned: Number(g.overrides[0]?.monthlyAmount ?? g.monthlyAmount),
        spent: g.expenses.reduce((s, e) => s + Number(e.amount), 0),
      }));

    const totalPlanned = groups.reduce((s, g) => s + g.planned, 0);
    const totalSpent = groups.reduce((s, g) => s + g.spent, 0);
    const budgetUsagePct = totalPlanned > 0 ? ((totalSpent / totalPlanned) * 100).toFixed(1) : "0";

    const groupsText = groups
      .map((g) => {
        const pct = g.planned > 0 ? ((g.spent / g.planned) * 100).toFixed(0) : "—";
        return `- ${g.name}: planejado ${fmt.format(g.planned)}, gasto ${fmt.format(g.spent)} (${pct}% do planejado)`;
      })
      .join("\n");

    const prompt = `Você é um assistente financeiro pessoal direto e prático. Analise os dados de gastos e responda APENAS com JSON válido, sem markdown, sem texto extra.

Data atual: ${today.toLocaleDateString("pt-BR")}
Próximo fim de semana: ${nextWeekend}
Mês de referência: ${selectedMonth}

ORÇAMENTO E GASTOS:
- Total orçado: ${fmt.format(totalPlanned)}
- Total gasto: ${fmt.format(totalSpent)} (${budgetUsagePct}% do orçamento)
- Sobra do orçamento: ${fmt.format(totalPlanned - totalSpent)}

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

    try {
      const result = await geminiModel.generateContent(prompt);
      const raw = result.response.text().trim().replace(/^```json?\s*/i, "").replace(/\s*```$/i, "");
      const parsed = JSON.parse(raw) as Omit<InsightsData, "currency">;
      return { ...parsed, currency };
    } catch (err) {
      console.error("[FinancialInsights] Gemini error:", err);
      return {
        riskLevel: "low",
        riskAlert: null,
        criticalGroups: [],
        weekendAdvice: "Não foi possível gerar recomendação agora.",
        leisureBudget: 0,
        recommendations: ["Configure a variável GEMINI_API_KEY para ativar os insights de IA."],
        currency,
      };
    }
  },
  ["financial-insights"],
  { revalidate: 86400, tags: ["financial-insights"] },
);

export async function FinancialInsights({ selectedMonth }: { selectedMonth: string }) {
  const session = await auth();
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) redirect("/login");

  const todayStr = new Date().toISOString().slice(0, 10);
  const insights = await getCachedInsights(user.id, selectedMonth, todayStr);
  const fmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: insights.currency });

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
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
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
