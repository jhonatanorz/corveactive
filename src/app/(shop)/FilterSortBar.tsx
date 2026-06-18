// src/app/(shop)/FilterSortBar.tsx
"use client";

type Props = {
  activeFilterCount: number;
  sortLabel: string;
  onOpenFilter: () => void;
  onOpenSort: () => void;
};

export default function FilterSortBar({ activeFilterCount, sortLabel, onOpenFilter, onOpenSort }: Props) {
  return (
    <div className="sticky top-[64px] z-30 flex items-center gap-2 border-b border-line bg-white/95 px-4 py-3 backdrop-blur">
      <button type="button" onClick={onOpenFilter}
        className="flex items-center gap-2 rounded-pill border border-line-strong px-4 py-1.5 text-sm text-ink transition hover:bg-mist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filtros
        {activeFilterCount > 0 && (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-pill bg-royal px-1 text-xs text-ink-on-royal">
            {activeFilterCount}
          </span>
        )}
      </button>
      <button type="button" onClick={onOpenSort}
        className="flex items-center gap-2 rounded-pill border border-line-strong px-4 py-1.5 text-sm text-ink transition hover:bg-mist">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
        </svg>
        {sortLabel}
      </button>
    </div>
  );
}
