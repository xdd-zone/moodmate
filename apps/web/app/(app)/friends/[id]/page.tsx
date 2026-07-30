import type { Metadata } from "next";

import { FriendDetail } from "@/src/components/friends/friend-detail";

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

  return <FriendDetail friendId={id} />;
}
