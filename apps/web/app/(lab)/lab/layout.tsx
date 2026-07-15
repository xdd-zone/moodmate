import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Lab",
  description: "用于验证 Web 样式、主题、Query Provider 和 API 请求。",
};

export default function LabLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
