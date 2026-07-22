"use client";

import type { ComponentProps } from "react";

import { Button } from "./button";
import { cn } from "./lib/utils";

type PaginationProps = Omit<ComponentProps<"nav">, "onChange"> & {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  prevLabel?: string;
  nextLabel?: string;
};

function Pagination({
  className,
  page,
  pageCount,
  onPageChange,
  prevLabel = "上一页",
  nextLabel = "下一页",
  ...props
}: PaginationProps) {
  const safePageCount = Math.max(pageCount, 1);
  const hasPrev = page > 1;
  const hasNext = page < safePageCount;

  return (
    <nav
      aria-label="分页"
      className={cn("flex items-center justify-between gap-3", className)}
      data-slot="pagination"
      {...props}
    >
      <Button
        disabled={!hasPrev}
        onClick={() => onPageChange(page - 1)}
        size="sm"
        type="button"
        variant="secondary"
      >
        {prevLabel}
      </Button>
      <span className="text-xs text-muted" data-slot="pagination-status">
        第 {page} / {safePageCount} 页
      </span>
      <Button
        disabled={!hasNext}
        onClick={() => onPageChange(page + 1)}
        size="sm"
        type="button"
        variant="secondary"
      >
        {nextLabel}
      </Button>
    </nav>
  );
}

export { Pagination };
