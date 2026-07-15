import { ThemeScript } from "@repo/ui/theme-script";
import type { Metadata } from "next";
import localFont from "next/font/local";

import { QueryProvider } from "@/src/providers/query-provider";

import "./globals.css";

const mapleMono = localFont({
  variable: "--font-maple-mono",
  display: "swap",
  fallback: [
    "PingFang SC",
    "Hiragino Sans GB",
    "Noto Sans CJK SC",
    "Microsoft YaHei",
    "monospace",
  ],
  src: [
    {
      path: "./fonts/MapleMonoNormalNL-Regular.ttf.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/MapleMonoNormalNL-Italic.ttf.woff2",
      weight: "400",
      style: "italic",
    },
    {
      path: "./fonts/MapleMonoNormalNL-Medium.ttf.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/MapleMonoNormalNL-MediumItalic.ttf.woff2",
      weight: "500",
      style: "italic",
    },
    {
      path: "./fonts/MapleMonoNormalNL-SemiBold.ttf.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/MapleMonoNormalNL-SemiBoldItalic.ttf.woff2",
      weight: "600",
      style: "italic",
    },
    {
      path: "./fonts/MapleMonoNormalNL-Bold.ttf.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/MapleMonoNormalNL-BoldItalic.ttf.woff2",
      weight: "700",
      style: "italic",
    },
  ],
});

export const metadata: Metadata = {
  title: {
    default: "moodmate",
    template: "%s | moodmate",
  },
  description: "记录情绪、原因和下一步行动。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={mapleMono.variable}
      data-theme="latte"
      suppressHydrationWarning
    >
      <head>
        <ThemeScript />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
