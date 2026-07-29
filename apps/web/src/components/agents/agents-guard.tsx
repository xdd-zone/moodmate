"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { readClientSession } from "@/src/auth/client-session";
import { AgentsManager } from "@/src/components/agents/agents-manager";

export function AgentsGuard() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const storedSession = readClientSession();

    if (!storedSession) {
      router.replace("/");
      return;
    }

    setIsAuthorized(true);
  }, [router]);

  if (!isAuthorized) {
    return (
      <main
        aria-busy="true"
        className="grid min-h-svh place-items-center px-5 text-foreground"
      >
        <p className="text-sm text-muted" role="status">
          正在恢复登录状态
        </p>
      </main>
    );
  }

  return <AgentsManager />;
}
