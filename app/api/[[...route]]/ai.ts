import { z } from "zod";
import { Hono } from "hono";
import Groq from "groq-sdk";
import { parse, subDays } from "date-fns";
import { and, eq, gte, lte, sql } from "drizzle-orm";

import { clerkMiddleware, getAuth } from "@hono/clerk-auth";
import { zValidator } from "@hono/zod-validator";

import { db } from "@/db/drizzle";
import { accounts, transactions } from "@/db/schema";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || process.env.NEXT_PUBLIC_GROQ_API_KEY,
});

const app = new Hono().get(
  "/",
  clerkMiddleware(),
  zValidator(
    "query",
    z.object({
      from: z.string().optional(),
      to: z.string().optional(),
      accountId: z.string().optional(),
    }),
  ),
  async (c) => {
    const auth = getAuth(c);
    const { from, to, accountId } = c.req.valid("query");

    if (!auth?.userId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const defaultTo = new Date();
    const defaultFrom = subDays(defaultTo, 30);

    const startDate = from
      ? parse(from, "yyyy-MM-dd", new Date())
      : defaultFrom;
    const endDate = to ? parse(to, "yyyy-MM-dd", new Date()) : defaultTo;

    const [data] = await db
      .select({
        income:
          sql`SUM(CASE WHEN ${transactions.amount} >= 0 THEN ${transactions.amount} ELSE 0 END)`.mapWith(
            Number,
          ),
        expense:
          sql`SUM(CASE WHEN ${transactions.amount} < 0 THEN ${transactions.amount} ELSE 0 END)`.mapWith(
            Number,
          ),
        remaining: sql`SUM(${transactions.amount})`.mapWith(Number),
      })
      .from(transactions)
      .innerJoin(accounts, eq(transactions.accountId, accounts.id))
      .where(
        and(
          accountId ? eq(transactions.accountId, accountId) : undefined,
          eq(accounts.userId, auth.userId),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
        ),
      );

    const income = data.income / 1000;
    const expense = Math.abs(data.expense) / 1000;
    const remaining = data.remaining / 1000;

    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [
          {
            role: "user",
            content: `Based on the following financial data: 
            - Remaining: ${remaining} INR
            - Expense: ${expense} INR
            - Income: ${income} INR
            Provide a brief (65 words max) evaluation of the financial situation by comparing the percentage of remaining and the expense. Avoid bullet points and use casual English. Refer to me as "you". Also do not mention my own data if not necessary. Tone could be negative and positive as well..just talk like a friend. but always give a suggestion to improve or to invest. dont only sound like a moral support but give me a precise thing to do next. Suggest like a professional financer`,
          },
        ],
        model: "llama-3.1-8b-instant",
        temperature: 1,
        max_tokens: 1024,
        top_p: 1,
        stream: true,
      });

      const stream = new ReadableStream({
        async start(controller) {
          for await (const chunk of chatCompletion) {
            const content = chunk.choices[0]?.delta?.content || "";
            controller.enqueue(new TextEncoder().encode(content));
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    } catch (error) {
      console.error("AI Error:", error);
      return c.json({ error: "Failed to generate AI advice" }, 500);
    }
  },
);

export default app;
