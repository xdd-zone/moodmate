import type { Metadata } from "next";

import { AgentsGuard } from "@/src/components/agents/agents-guard";

export const metadata: Metadata = {
  title: "我的 Agent",
};

export default function AgentsPage() {
  return <AgentsGuard />;
}
