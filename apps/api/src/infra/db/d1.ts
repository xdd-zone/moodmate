import { drizzle } from "drizzle-orm/d1";

export function createD1Client(database: D1Database | undefined) {
  if (!database) {
    throw new Error("D1 binding DB 未配置");
  }

  return drizzle(database);
}

export async function checkD1Readiness(
  database: D1Database | undefined,
): Promise<void> {
  if (!database) {
    throw new Error("D1 binding DB 未配置");
  }

  const result = await database
    .prepare("SELECT 1 AS ok")
    .first<{ ok: number }>();

  if (result?.ok !== 1) {
    throw new Error("D1 连通性查询返回无效结果");
  }
}
