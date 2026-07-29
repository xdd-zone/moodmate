import { Button } from "@repo/ui/button";
import { ThemeToggle } from "@repo/ui/theme-toggle";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { FaGithub } from "react-icons/fa6";

export const metadata: Metadata = {
  title: "GitHub 登录暂未开放",
};

export default function GithubCallbackPage() {
  return (
    <main className="moodmate moodmate-auth">
      <header className="moodmate-auth__topnav">
        <div className="moodmate-auth__container moodmate-auth__topnav-inner">
          <Link
            aria-label="返回 MoodMate 首页"
            className="moodmate-auth__brand"
            href="/"
          >
            <span aria-hidden="true" className="moodmate-auth__brand-mark">
              M
            </span>
            <span>MoodMate</span>
          </Link>
          <ThemeToggle
            className="moodmate-auth__theme-toggle"
            variant="ghost"
          />
        </div>
      </header>

      <section className="moodmate-auth__stage moodmate-auth__stage--status">
        <div className="moodmate-auth__container moodmate-auth__status-wrap">
          <section className="moodmate-auth__status-panel">
            <span aria-hidden="true" className="moodmate-auth__status-icon">
              <FaGithub />
            </span>
            <p className="moodmate-auth__panel-kicker">GitHub 登录</p>
            <h1>这个入口暂未开放。</h1>
            <p>
              当前页面不会处理授权
              ticket，也不会创建登录状态。请返回首页，使用邮箱密码登录。
            </p>
            <Button asChild className="moodmate-auth__primary-button" size="lg">
              <Link href="/">
                <ArrowLeft aria-hidden="true" />
                返回首页
              </Link>
            </Button>
            <span className="moodmate-auth__secure-note">
              <LockKeyhole aria-hidden="true" />
              未读取授权参数
            </span>
          </section>
        </div>
      </section>
    </main>
  );
}
