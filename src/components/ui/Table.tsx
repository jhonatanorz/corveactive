import type { ReactNode } from "react";

/** Card-framed, horizontally-scrollable table shell. */
export function Table({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto border border-line bg-white shadow-sm ${className}`}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function THead({ children }: { children: ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-line bg-mist/50 text-left">{children}</tr>
    </thead>
  );
}

export function Th({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3 ${className}`}>
      {children}
    </th>
  );
}

export function Td({ children, className = "", colSpan }: { children?: ReactNode; className?: string; colSpan?: number }) {
  return (
    <td colSpan={colSpan} className={`px-4 py-3 align-middle text-ink ${className}`}>
      {children}
    </td>
  );
}

/** Static (non-clickable) row. */
export function Tr({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <tr className={`border-b border-line/70 last:border-0 ${className}`}>{children}</tr>;
}
