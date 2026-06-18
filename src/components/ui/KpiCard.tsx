import type { ReactNode } from "react";

/** Reusable metric card: icon badge + uppercase label, a large value, and an
 *  optional hint line. Shared by the Ventas KPIs and the Inventario value card. */
export function KpiCard({
  label,
  value,
  icon,
  hint,
  valueClassName = "text-ink",
  className = "",
}: {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  hint?: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border border-line bg-white p-4 shadow-1 ${className}`}>
      <div className="mb-2 flex items-center gap-2">
        {icon && (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-mist text-royal">
            {icon}
          </span>
        )}
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">{label}</span>
      </div>
      <div className={`text-3xl font-bold tracking-tight ${valueClassName}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-3">{hint}</div>}
    </div>
  );
}
