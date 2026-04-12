import { Router, type IRouter } from "express";
import { db, chatMessagesTable } from "@workspace/db";
import { openai } from "@workspace/integrations-openai-ai-server";
import { serializeRows, serializeRow } from "../lib/serialize";
import { SendChatMessageBody, SendChatMessageResponse, GetChatHistoryResponse } from "@workspace/api-zod";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "../lib/logger";

const router: IRouter = Router();

router.get("/chat/history", async (req, res): Promise<void> => {
  const userId = req.userId;
  const messages = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.clerkUserId, userId)).orderBy(chatMessagesTable.createdAt);
  res.json(GetChatHistoryResponse.parse(serializeRows(messages)));
});

router.delete("/chat/history", async (req, res): Promise<void> => {
  const userId = req.userId;
  await db.delete(chatMessagesTable).where(eq(chatMessagesTable.clerkUserId, userId));
  res.sendStatus(204);
});

router.post("/chat", async (req, res): Promise<void> => {
  const userId = req.userId;
  const parsed = SendChatMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const userMessage = parsed.data.message;

  await db.insert(chatMessagesTable).values({ clerkUserId: userId, role: "user", content: userMessage });

  const history = await db.select().from(chatMessagesTable).where(eq(chatMessagesTable.clerkUserId, userId)).orderBy(chatMessagesTable.createdAt);

  const chatMessages = [
    {
      role: "system" as const,
      content: `You are GymAssist, an expert AI fitness coach and health advisor. Help users with:
- Creating and optimizing workout plans
- Exercise form, technique, and recommendations
- Health monitoring and tracking (weight, steps, sleep, calories, etc.)
- Nutrition and recovery advice
- Motivation and goal setting

Be concise, practical, and encouraging. Tailor your advice to the user's fitness level and goals. Always prioritize safety and proper form.`,
    },
    ...history.map((msg) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    })),
  ];

  let reply = "";

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-5.2",
      max_completion_tokens: 8192,
      messages: chatMessages,
    });

    reply = response.choices[0]?.message?.content ?? "I'm sorry, I couldn't generate a response. Please try again.";
  } catch (err) {
    logger.error({ err }, "OpenAI chat completion error");
    reply = "I'm having trouble connecting right now. Please try again in a moment.";
  }

  const [assistantMessage] = await db.insert(chatMessagesTable).values({ clerkUserId: userId, role: "assistant", content: reply }).returning();

  res.json(SendChatMessageResponse.parse(serializeRow({ reply, messageId: assistantMessage.id })));
});

export default router;
