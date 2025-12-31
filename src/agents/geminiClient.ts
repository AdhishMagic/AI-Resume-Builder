import { GoogleGenerativeAI } from "@google/generative-ai";

export class MissingGeminiApiKeyError extends Error {
  constructor() {
    super("Gemini is not enabled. Set VITE_ENABLE_GEMINI=true and VITE_GOOGLE_API_KEY in .env.local, then restart the dev server.");
    this.name = "MissingGeminiApiKeyError";
  }
}

export const createGenAI = () => {
  const enabled = String(import.meta.env.VITE_ENABLE_GEMINI || "").trim().toLowerCase() === "true";
  const apiKey = (import.meta.env.VITE_GOOGLE_API_KEY as string | undefined)?.trim();
  if (!enabled || !apiKey) {
    throw new MissingGeminiApiKeyError();
  }
  return new GoogleGenerativeAI(apiKey);
};

export const getHumanGeminiErrorMessage = (error: unknown) => {
  const anyErr = error as any;
  const status = anyErr?.status;
  const message: string = anyErr?.message || String(error);

  if (status === 403 || message.includes("[403") || message.includes(" 403")) {
    if (message.toLowerCase().includes("reported as leaked") || message.toLowerCase().includes("leaked")) {
      return "Gemini rejected the API key because it was reported as leaked. Create a new key, put it in .env.local as VITE_GOOGLE_API_KEY, and restart the dev server.";
    }
    return "Gemini request was forbidden (403). Verify your API key is valid and properly restricted, then restart the dev server.";
  }

  if (status === 429 || message.includes("[429") || message.includes(" 429")) {
    return "Gemini quota/rate limit hit (429). Wait a bit and try again.";
  }

  if (message.toLowerCase().includes("missing gemini api key")) {
    return message;
  }

  return "Gemini request failed. Check your API key and network, then try again.";
};
