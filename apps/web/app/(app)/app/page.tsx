import type { Metadata } from "next";

import { WebDashboardGuard } from "@/src/components/web-dashboard-guard";

export const metadata: Metadata = {
  title: "应用",
};

export default function AppEntryPage() {
  return <WebDashboardGuard />;
}
