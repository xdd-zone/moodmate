import type { ReactNode } from "react";

import { AuthenticatedAppLayout } from "@/src/components/app/authenticated-app-layout";

type AppLayoutProps = {
  children: ReactNode;
};

export default function AppLayout({ children }: AppLayoutProps) {
  return <AuthenticatedAppLayout>{children}</AuthenticatedAppLayout>;
}
