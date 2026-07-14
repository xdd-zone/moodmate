import { Badge } from "@repo/ui/badge";
import { Button } from "@repo/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@repo/ui/card";

const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:6155";
const serviceStatusHref = `${apiBaseUrl.replace(/\/$/, "")}/health`;

export default function Home() {
  return (
    <main className="min-h-svh px-5 py-6 text-foreground md:px-8">
      <div className="mx-auto flex min-h-[calc(100svh-48px)] max-w-6xl flex-col">
        <header className="flex items-center gap-3 border-b border-border py-4">
          <span className="text-sm font-semibold">moodmate</span>
          <Badge variant="outline">admin</Badge>
        </header>

        <section className="grid flex-1 content-center items-start gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.62fr)]">
          <div className="max-w-2xl">
            <Badge className="mb-5" variant="secondary">
              管理工作区
            </Badge>
            <h1 className="text-4xl leading-tight font-semibold text-balance md:text-5xl">
              moodmate 管理台
            </h1>
            <p className="mt-5 max-w-[52ch] text-base leading-7 text-muted">
              后台业务尚未接入。当前保留管理端入口，并提供 API 服务状态检查。
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>服务连接</CardTitle>
              <CardDescription>
                打开 API 健康检查，确认本地服务是否可用。
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex min-h-11 items-center justify-between gap-4 border-y border-border py-3 text-sm">
                <span>API 健康检查</span>
                <Badge>可打开</Badge>
              </div>
              <Button asChild>
                <a href={serviceStatusHref}>查看服务状态</a>
              </Button>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
