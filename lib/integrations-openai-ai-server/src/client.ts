import OpenAI from "openai";

const useReplitProxy =
  process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
  process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const useDirectOpenAI = process.env.OPENAI_API_KEY;

if (!useReplitProxy && !useDirectOpenAI) {
  throw new Error(
    "No OpenAI credentials found. Set OPENAI_API_KEY for local development, " +
    "or provision the OpenAI AI integration on Replit.",
  );
}

export const openai = new OpenAI(
  useReplitProxy
    ? {
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      }
    : {
        apiKey: process.env.OPENAI_API_KEY,
      },
);
