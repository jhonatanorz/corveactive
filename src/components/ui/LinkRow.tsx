"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, ReactNode } from "react";

/** A table row that navigates to `href` when clicked (whole-row click target),
 *  with hover/focus highlight and keyboard support. Pair with a trailing chevron
 *  cell using `group-hover:` to signal it is clickable. */
export function LinkRow({
  href,
  children,
  className = "",
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  const go = () => router.push(href);
  const onKey = (e: KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      go();
    }
  };
  return (
    <tr
      onClick={go}
      onKeyDown={onKey}
      onMouseEnter={() => router.prefetch(href)}
      tabIndex={0}
      role="link"
      className={`group cursor-pointer border-b border-line/70 outline-none transition-colors last:border-0 hover:bg-periwinkle-2/40 focus-visible:bg-periwinkle-2/40 ${className}`}
    >
      {children}
    </tr>
  );
}

/** Trailing chevron cell that nudges right + colors on row hover. Use as the last
 *  cell of a LinkRow. */
export function ChevronCell() {
  return (
    <td className="w-8 px-4 py-3 text-right align-middle text-ink-3 transition-all group-hover:translate-x-0.5 group-hover:text-royal">
      <span aria-hidden>›</span>
    </td>
  );
}
