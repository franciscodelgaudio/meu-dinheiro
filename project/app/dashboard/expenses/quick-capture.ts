"use server";

export type ExpenseGroupSuggestion = {
  id: string;
  name: string;
};

export type QuickExpenseSuggestion = {
  clientId: string;
  amount: number;
  description: string;
  suggestedGroup: string;
  suggestedGroupId: string | null;
  date: string;
  confidence: number;
};

export type QuickExpenseBatchSuggestion = {
  items: QuickExpenseSuggestion[];
  totalAmount: number;
  confidence: number;
};

type AnalyzeQuickExpenseInput = {
  text: string;
  images?: File[];
  groups: ExpenseGroupSuggestion[];
  today: string;
  selectedMonth: string;
};

type GeminiContentPart =
  | { text: string }
  | { inline_data: { mime_type: string; data: string } };

const quickExpenseSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        properties: {
          amount: { type: "number" },
          description: { type: "string" },
          suggestedGroup: { type: "string" },
          date: { type: "string" },
          confidence: { type: "number" },
        },
        required: [
          "amount",
          "description",
          "suggestedGroup",
          "date",
          "confidence",
        ],
      },
    },
    totalAmount: { type: "number" },
    confidence: { type: "number" },
  },
  required: ["items", "totalAmount", "confidence"],
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getGeminiOutputText(response: unknown) {
  if (
    response &&
    typeof response === "object" &&
    "candidates" in response &&
    Array.isArray(response.candidates)
  ) {
    const candidate = response.candidates[0];

    if (
      candidate &&
      typeof candidate === "object" &&
      "content" in candidate &&
      candidate.content &&
      typeof candidate.content === "object" &&
      "parts" in candidate.content &&
      Array.isArray(candidate.content.parts)
    ) {
      for (const part of candidate.content.parts) {
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }
      }
    }
  }

  return "";
}

function parseJsonObject(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("A IA nao retornou JSON valido.");
    }

    return JSON.parse(match[0]);
  }
}

function matchSuggestedGroup(
  suggestedGroup: string,
  groups: ExpenseGroupSuggestion[],
) {
  const normalizedSuggestion = normalizeText(suggestedGroup);

  return (
    groups.find((group) => normalizeText(group.name) === normalizedSuggestion) ??
    groups.find((group) =>
      normalizeText(group.name).includes(normalizedSuggestion),
    ) ??
    groups.find((group) =>
      normalizedSuggestion.includes(normalizeText(group.name)),
    ) ??
    null
  );
}

function sanitizeSuggestionItem(
  value: unknown,
  groups: ExpenseGroupSuggestion[],
  today: string,
  index: number,
): QuickExpenseSuggestion {
  const parsed: Record<string, unknown> =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const amount = Number(parsed.amount ?? 0);
  const description = String(
    parsed.description ?? "Gasto",
  ).trim();
  const suggestedGroup = String(
    parsed.suggestedGroup ?? groups[0]?.name ?? "",
  ).trim();
  const date = String(parsed.date ?? today).trim();
  const confidence = Number(parsed.confidence ?? 0.5);
  const matchedGroup = matchSuggestedGroup(suggestedGroup, groups);

  return {
    clientId: `quick-${Date.now()}-${index}`,
    amount: Number.isFinite(amount) ? Number(amount.toFixed(2)) : 0,
    description: description || "Gasto",
    suggestedGroup: matchedGroup?.name ?? suggestedGroup ?? groups[0]?.name ?? "",
    suggestedGroupId: matchedGroup?.id ?? groups[0]?.id ?? null,
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today,
    confidence: Number.isFinite(confidence) ? clamp(confidence, 0, 1) : 0.5,
  };
}

function sanitizeBatchSuggestion(
  value: unknown,
  groups: ExpenseGroupSuggestion[],
  today: string,
): QuickExpenseBatchSuggestion {
  const parsed: Record<string, unknown> =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const rawItems = Array.isArray(parsed.items) ? parsed.items : [parsed];
  const items = rawItems
    .map((item, index) => sanitizeSuggestionItem(item, groups, today, index))
    .filter((item) => item.amount > 0);
  const normalizedItems =
    items.length > 0 ? items : [sanitizeSuggestionItem({}, groups, today, 0)];
  const totalAmount = normalizedItems.reduce(
    (total, item) => total + item.amount,
    0,
  );
  const confidence = Number(parsed.confidence ?? 0.5);

  return {
    items: normalizedItems,
    totalAmount: Number(totalAmount.toFixed(2)),
    confidence: Number.isFinite(confidence) ? clamp(confidence, 0, 1) : 0.5,
  };
}

async function fileToBase64(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());

  return buffer.toString("base64");
}

export async function analyzeQuickExpenseWithAI({
  text,
  images,
  groups,
  today,
  selectedMonth,
}: AnalyzeQuickExpenseInput): Promise<QuickExpenseBatchSuggestion> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY nao configurada.");
  }

  const groupNames = groups.map((group) => group.name).join(", ");
  const prompt = [
    "Interprete um gasto pessoal no Brasil e retorne somente dados estruturados.",
    `Data de hoje: ${today}. Mes selecionado: ${selectedMonth}.`,
    `Grupos existentes do usuario: ${groupNames || "nenhum"}.`,
    "Use suggestedGroup com o grupo existente mais provavel. Se nao houver match claro, escolha o mais proximo.",
    "Se a entrada tiver itens de grupos diferentes, devolva um item por grupo ja agrupado.",
    "Exemplo: alimentos e higiene na mesma nota devem virar duas linhas: Alimentacao e Higiene.",
    "Nao precisa listar cada produto pequeno; agrupe pelo grupo financeiro util.",
    "Para imagens, extraia estabelecimento, valor total, data e contexto visual/textual.",
    `Entrada do usuario: ${text || "(sem texto, analisar imagem)"}`,
  ].join("\n");
  const parts: GeminiContentPart[] = [
    {
      text: prompt,
    },
  ];

  for (const image of images ?? []) {
    if (!image || image.size === 0) continue;

    if (!image.type.startsWith("image/")) {
      throw new Error("Envie apenas imagens validas.");
    }

    if (image.size > 8 * 1024 * 1024) {
      throw new Error(`A imagem "${image.name}" precisa ter ate 8 MB.`);
    }

    parts.push({
      inline_data: {
        mime_type: image.type,
        data: await fileToBase64(image),
      },
    });
  }

  const model = process.env.GEMINI_QUICK_CAPTURE_MODEL ?? "gemini-2.5-flash";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts,
          },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: quickExpenseSchema,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Nao foi possivel interpretar o gasto agora. Gemini retornou ${response.status}: ${errorText}`,
    );
  }

  const data: unknown = await response.json();
  const outputText = getGeminiOutputText(data);

  if (!outputText) {
    throw new Error("A IA nao retornou uma interpretacao utilizavel.");
  }

  return sanitizeBatchSuggestion(parseJsonObject(outputText), groups, today);
}
