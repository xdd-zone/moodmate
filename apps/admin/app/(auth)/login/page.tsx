import type { Metadata } from "next";

import { LoginForm } from "@/src/components/auth/login-form";

export const metadata: Metadata = {
  title: "管理员登录 | moodmate",
};

export default function LoginPage() {
  return <LoginForm />;
}
