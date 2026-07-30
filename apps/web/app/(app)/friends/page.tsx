import type { Metadata } from "next";

import { FriendsList } from "@/src/components/friends/friends-list";

export const metadata: Metadata = {
  title: "通讯录",
};

export default function FriendsPage() {
  return <FriendsList />;
}
