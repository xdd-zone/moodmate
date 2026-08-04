import { z } from "zod";

import { type AiCallObserver, type AiModel } from "@/infra/ai";
import {
  insertAgentMemory,
  listActiveAgentMemories,
} from "@/modules/agents/agents.repository";
import { generateStructuredJson } from "./direct-chat.structured";

const memoryJudgementSchema = z.object({
  shouldStore: z.boolean(),
  reason: z.string().trim().max(240),
});

const memoryExtractionSchema = z.object({
  memories: z
    .array(
      z.object({
        content: z.string().trim().min(1).max(2000),
        importance: z.number().int().min(1).max(5),
        type: z.string().trim().min(1).max(80),
      }),
    )
    .max(2),
});

function normalizeMemoryContent(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("zh-CN");
}

export async function organizeDirectChatMemories(input: {
  agentId: string;
  assistantText: string;
  database: D1Database | undefined;
  extractionObserver: AiCallObserver;
  judgementObserver: AiCallObserver;
  model: AiModel;
  signal: AbortSignal;
  sourceMessageId: string;
  userId: string;
  userText: string;
}) {
  try {
    const judgement = await generateStructuredJson({
      maxTokens: 240,
      messages: [
        {
          role: "system",
          content:
            "判断用户消息是否包含以后对话仍有用的稳定偏好、习惯、边界、重要关系或明确要求记住的事实。临时情绪、普通寒暄和模型推断不要保存。",
        },
        { role: "user", content: input.userText },
      ],
      model: input.model,
      observer: input.judgementObserver,
      schema: memoryJudgementSchema,
      schemaName: "direct_memory_judgement",
      signal: input.signal,
    });

    if (!judgement.shouldStore) return;

    const existingMemories = await listActiveAgentMemories({
      agentId: input.agentId,
      database: input.database,
      limit: 50,
      userId: input.userId,
    });
    const existingText = existingMemories
      .map((memory) => `- ${memory.content}`)
      .join("\n");
    const extraction = await generateStructuredJson({
      maxTokens: 500,
      messages: [
        {
          role: "system",
          content:
            "从当前一轮对话整理最多两条长期记忆。每条只写用户明确表达的事实，不写模型猜测，不复述已有记忆。type 使用简短中文分类，importance 为 1 到 5。",
        },
        {
          role: "user",
          content: `用户消息：${input.userText}\n朋友回复：${input.assistantText}\n已有记忆：\n${existingText || "暂无"}`,
        },
      ],
      model: input.model,
      observer: input.extractionObserver,
      schema: memoryExtractionSchema,
      schemaName: "direct_memory_extraction",
      signal: input.signal,
    });

    const knownContents = new Set(
      existingMemories.map((memory) => normalizeMemoryContent(memory.content)),
    );

    for (const memory of extraction.memories) {
      const normalized = normalizeMemoryContent(memory.content);
      if (!normalized || knownContents.has(normalized)) continue;

      await insertAgentMemory({
        agentId: input.agentId,
        content: memory.content.trim(),
        database: input.database,
        importance: memory.importance,
        nowMs: Date.now(),
        sourceMessageId: input.sourceMessageId,
        type: memory.type.trim(),
        userId: input.userId,
      });
      knownContents.add(normalized);
    }
  } catch (error) {
    console.warn("单聊记忆整理失败，跳过本轮记忆写入", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
