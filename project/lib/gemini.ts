import { GoogleGenerativeAI } from "@google/generative-ai";

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? "");

export const geminiModel = genai.getGenerativeModel({ model: "gemini-2.5-flash" });
