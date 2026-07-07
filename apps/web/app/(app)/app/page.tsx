import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "应用入口",
};

export default function AppEntryPage() {
  return (
    <main className="min-h-svh px-[clamp(20px,6vw,80px)] py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100svh-64px)] max-w-4xl flex-col justify-center">
        <Link
          className="mb-10 w-fit rounded-sm text-sm text-muted transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
          href="/"
        >
          返回首页
        </Link>

        <section className="rounded-xl border border-border bg-surface/85 p-6 shadow-soft md:p-8">
          <p className="text-sm text-muted">moodmate app</p>
          <h1 className="mt-3 text-[clamp(2rem,5vw,4rem)] font-semibold leading-tight tracking-[-0.04em]">
            应用入口先放在这里。
          </h1>
          <p className="mt-5 max-w-[58ch] text-base leading-7 text-muted">
            后续情绪记录、历史列表、趋势和账号相关页面从这里继续加。当前阶段先保留入口，避免首页和应用页混在一起。
          </p>
        </section>
      </div>
    </main>
  );
}
