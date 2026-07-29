import type { Metadata } from "next";

import { FriendsGuard } from "@/src/components/friends/friends-guard";

export const metadata: Metadata = {
  title: "通讯录",
};

export default function FriendsPage() {
  return <FriendsGuard />;
}
