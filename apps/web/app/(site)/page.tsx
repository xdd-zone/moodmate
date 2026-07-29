import type { Metadata } from "next";

import { LoginForm } from "@/src/components/auth/login-form";

export const metadata: Metadata = {
  title: "欢迎回来",
};

export default function Home() {
  return <LoginForm />;
}
