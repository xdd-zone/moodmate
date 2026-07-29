/**
 * OpenAI-compatible Provider 目录出口。
 *
 * 只导出 MoodMate 内部类型形态的 Provider 实例。SDK 类型不从这里离开目录：
 * mapper 与 provider 内部引用的 `openai` 类型不做 re-export。
 */

export { openAiCompatibleProvider } from "./openai-compatible.provider";
