import type { Metadata } from "next";

import { SettingsGuard } from "@/src/components/settings/settings-guard";

export const metadata: Metadata = {
  title: "设置",
};

export default function SettingsPage() {
  return <SettingsGuard />;
}
