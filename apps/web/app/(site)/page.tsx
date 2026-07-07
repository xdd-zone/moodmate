import Link from "next/link";

const moodOptions = [
  { label: "平静", color: "bg-primary" },
  { label: "有点累", color: "bg-warm" },
  { label: "紧张", color: "bg-rose" },
];

const steps = ["写下情绪", "记下原因", "选一个下一步行动"];
const apiBaseUrl =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
const serviceStatusHref = `${apiBaseUrl.replace(/\/$/, "")}/health`;

export default function Home() {
  return (
    <main className="min-h-svh px-[clamp(20px,6vw,80px)] py-6 text-foreground">
      <div className="mx-auto flex min-h-[calc(100svh-48px)] max-w-7xl flex-col">
        <header className="flex items-center justify-between border-b border-border/70 py-4 text-sm">
          <Link
            className="rounded-sm font-semibold tracking-[-0.02em] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            href="/"
          >
            moodmate
          </Link>
          <nav className="flex items-center gap-3 text-muted">
            <a
              className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              href={serviceStatusHref}
            >
              服务状态
            </a>
            <Link
              className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
              href="/app"
            >
              进入应用
            </Link>
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[minmax(0,0.92fr)_minmax(360px,0.72fr)] lg:py-20">
          <div className="max-w-3xl animate-rise-soft">
            <p className="mb-5 inline-flex rounded-sm border border-border bg-surface/80 px-3 py-1.5 text-sm text-muted shadow-soft">
              情绪记录工具
            </p>
            <h1 className="text-[clamp(2.5rem,7vw,6.3rem)] font-semibold leading-[0.98] tracking-[-0.05em]">
              先把今天
              <span className="block text-primary">放轻一点。</span>
            </h1>
            <p className="mt-7 max-w-[56ch] text-base leading-7 text-muted md:text-lg md:leading-8">
              moodmate
              用来记录情绪、原因和下一步行动。先写清楚发生了什么，再决定今天要做哪一件小事。
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-soft transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                href="/app"
              >
                开始记录
              </Link>
              <a
                className="inline-flex min-h-11 items-center justify-center rounded-md border border-border bg-surface/70 px-5 text-sm font-semibold text-foreground transition-colors hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
                href={serviceStatusHref}
              >
                查看服务状态
              </a>
            </div>
          </div>

          <aside className="animate-rise-soft rounded-xl border border-border bg-surface/85 p-5 shadow-soft [animation-delay:120ms]">
            <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
              <div>
                <p className="text-sm text-muted">今日记录</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em]">
                  先选一个接近的状态
                </h2>
              </div>
              <span className="rounded-sm bg-soft px-2.5 py-1 text-xs text-muted">
                草稿
              </span>
            </div>

            <div className="space-y-6 py-6">
              <section>
                <p className="mb-3 text-sm text-muted">情绪</p>
                <div className="flex flex-wrap gap-2">
                  {moodOptions.map((option) => (
                    <span
                      className="inline-flex items-center gap-2 rounded-md border border-border bg-background/70 px-3 py-2 text-sm"
                      key={option.label}
                    >
                      <i className={`size-2 rounded-sm ${option.color}`} />
                      {option.label}
                    </span>
                  ))}
                </div>
              </section>

              <section>
                <p className="mb-3 text-sm text-muted">原因</p>
                <div className="rounded-lg border border-border bg-background/70 p-4 text-sm leading-6 text-foreground">
                  今天事情不多，但脑子一直停不下来。先把待办拆小，不急着一次做完。
                </div>
              </section>

              <section>
                <p className="mb-3 text-sm text-muted">下一步行动</p>
                <div className="grid gap-2">
                  {steps.map((step, index) => (
                    <div
                      className="flex items-center gap-3 rounded-md bg-soft px-3 py-2 text-sm"
                      key={step}
                    >
                      <span className="grid size-6 place-items-center rounded-sm bg-surface text-xs text-muted">
                        {index + 1}
                      </span>
                      {step}
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
