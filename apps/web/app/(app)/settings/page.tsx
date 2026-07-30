import type { Metadata } from "next";

import { SettingsWorkspace } from "@/src/components/settings/settings-workspace";

export const metadata: Metadata = {
  title: "设置",
};

export default function SettingsPage() {
  return <SettingsWorkspace />;
}
