type GeminiChatMessage = {
  role: "user" | "model";
  parts: { text: string }[];
};

type GeminiStartChatInput = {
  history: GeminiChatMessage[];
  systemInstruction: GeminiChatMessage;
};

type GeminiUsageMetadata = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
};

type GeminiStreamResult = {
  stream: AsyncIterable<{ text(): string }>;
  response: Promise<{ usageMetadata?: GeminiUsageMetadata | null }>;
};

async function* emptyStream() {
  yield {
    text() {
      return "";
    },
  };
}

export const geminiModel = {
  startChat(_input: GeminiStartChatInput) {
    return {
      async sendMessageStream(_message: string): Promise<GeminiStreamResult> {
        throw new Error(
          "Chat Gemini nao configurado neste build. Configure a integracao antes de usar o assistente.",
        );

        return {
          stream: emptyStream(),
          response: Promise.resolve({ usageMetadata: null }),
        };
      },
    };
  },
};
