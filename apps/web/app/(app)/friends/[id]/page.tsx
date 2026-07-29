import type { Metadata } from "next";

import { FriendsGuard } from "@/src/components/friends/friends-guard";

export const metadata: Metadata = {
  title: "朋友档案",
};

type FriendDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function FriendDetailPage({
  params,
}: FriendDetailPageProps) {
  const { id } = await params;

  return <FriendsGuard friendId={id} />;
}
