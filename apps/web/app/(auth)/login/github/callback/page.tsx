import type { Metadata } from "next";
import { Suspense } from "react";

import {
  GithubCallback,
  GithubCallbackStatus,
} from "@/src/components/auth/github-callback";

export const metadata: Metadata = {
  title: "GitHub 登录",
};

export default function GithubCallbackPage() {
  return (
    <Suspense fallback={<GithubCallbackStatus errorMessage={null} />}>
      <GithubCallback />
    </Suspense>
  );
}
