import { Slot } from "@radix-ui/react-slot";
import type { ComponentProps } from "react";

import { cn } from "./lib/utils";

function AppShell({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "min-h-svh text-foreground md:grid md:grid-cols-[var(--sidebar-w,16rem)_minmax(0,1fr)]",
        className,
      )}
      data-slot="app-shell"
      {...props}
    />
  );
}

function Sidebar({ className, ...props }: ComponentProps<"aside">) {
  return (
    <aside
      className={cn(
        "flex flex-col gap-4 border-b border-border bg-surface px-4 py-4 md:sticky md:top-0 md:h-svh md:border-b-0 md:border-r",
        className,
      )}
      data-slot="sidebar"
      {...props}
    />
  );
}

function SidebarHeader({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      data-slot="sidebar-header"
      {...props}
    />
  );
}

function SidebarNav({ className, ...props }: ComponentProps<"nav">) {
  return (
    <nav
      className={cn("flex flex-col gap-1", className)}
      data-slot="sidebar-nav"
      {...props}
    />
  );
}

type SidebarNavItemProps = ComponentProps<"a"> & {
  asChild?: boolean;
  active?: boolean;
};

function SidebarNavItem({
  className,
  asChild = false,
  active = false,
  ...props
}: SidebarNavItemProps) {
  const Comp = asChild ? Slot : "a";

  return (
    <Comp
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-11 items-center rounded-md px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        active
          ? "bg-primary-subtle text-primary-strong"
          : "text-muted hover:bg-surface-muted hover:text-foreground",
        className,
      )}
      data-slot="sidebar-nav-item"
      {...props}
    />
  );
}

function SidebarFooter({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mt-auto flex flex-col gap-2", className)}
      data-slot="sidebar-footer"
      {...props}
    />
  );
}

function AppShellHeader({ className, ...props }: ComponentProps<"header">) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-center gap-3 border-b border-border px-5 py-3 md:px-8",
        className,
      )}
      data-slot="app-shell-header"
      {...props}
    />
  );
}

function AppShellContent({ className, ...props }: ComponentProps<"main">) {
  return (
    <main
      className={cn("px-5 py-6 md:px-8", className)}
      data-slot="app-shell-content"
      {...props}
    />
  );
}

export {
  AppShell,
  AppShellContent,
  AppShellHeader,
  Sidebar,
  SidebarFooter,
  SidebarHeader,
  SidebarNav,
  SidebarNavItem,
};
