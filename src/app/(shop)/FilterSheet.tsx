"use client";

import { BottomSheet } from "@/components/ui";

export type ChipOption = { value: string; label: string };
export type SwatchOption = { value: string; label: string; hex: string };
export type FilterGroup =
  | { key: string; label: string; type: "chips"; options: ChipOption[]; selected: string[] }
  | { key: string; label: string; type: "swatches"; options: SwatchOption[]; selected: string[] };

type Props = {
  open: boolean;
  onClose: () => void;
  groups: FilterGroup[];
  onToggle: (groupKey: string, value: string) => void;
  onClear: () => void;
  resultCount: number;
};

export default function FilterSheet({ open, onClose, groups, onToggle, onClear, resultCount }: Props) {
  const anySelected = groups.some((g) => g.selected.length > 0);
  return (
    <BottomSheet open={open} onClose={onClose} title="Filtros">
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-ink-3">{g.label}</div>
            {g.type === "chips" ? (
              <div className="flex flex-wrap gap-1.5">
                {g.options.map((o) => {
                  const on = g.selected.includes(o.value);
                  return (
                    <button key={o.value} type="button" onClick={() => onToggle(g.key, o.value)} aria-pressed={on}
                      className={`rounded-pill border px-3 py-1 text-xs transition ${on ? "border-transparent bg-royal text-ink-on-royal" : "border-line-strong text-ink-2 hover:text-ink"}`}>
                      {o.label}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {g.options.map((o) => {
                  const on = g.selected.includes(o.value);
                  return (
                    <button key={o.value} type="button" onClick={() => onToggle(g.key, o.value)} aria-label={o.label} title={o.label} aria-pressed={on}
                      className={`h-7 w-7 rounded-pill border border-line transition ${on ? "ring-2 ring-royal ring-offset-1" : ""}`}
                      style={{ background: o.hex }} />
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-between">
        {anySelected ? (
          <button type="button" onClick={onClear} className="text-sm text-royal hover:underline">Limpiar</button>
        ) : (
          <span />
        )}
        <button type="button" onClick={onClose} className="rounded-pill bg-royal px-5 py-2 text-sm text-ink-on-royal">
          Ver resultados ({resultCount})
        </button>
      </div>
    </BottomSheet>
  );
}
