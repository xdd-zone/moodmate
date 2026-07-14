import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import { Card, CardHeader } from "@repo/ui/card";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "应用入口",
};

export default function AppEntryPage() {
  return (
    <main className="min-h-svh px-[clamp(20px,6vw,80px)] py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100svh-64px)] max-w-4xl flex-col justify-center">
        <Button asChild className="mb-8 w-fit" variant="ghost">
          <Link href="/">返回首页</Link>
        </Button>

        <Card>
          <CardHeader className="gap-3 md:p-8">
            <Badge variant="outline">moodmate app</Badge>
            <h1 className="text-3xl leading-tight font-semibold text-balance md:text-5xl">
              应用入口先放在这里。
            </h1>
            <p className="max-w-[58ch] text-base leading-7 text-muted">
              后续情绪记录、历史列表、趋势和账号相关页面从这里继续加。当前阶段先保留入口，避免首页和应用页混在一起。
            </p>
          </CardHeader>
        </Card>
      </div>
    </main>
  );
}
