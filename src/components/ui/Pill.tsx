import type { ReactNode } from "react";

const TONES = {
  neutral: "bg-mist text-ink-2",
  info: "bg-periwinkle-2 text-royal",
  success: "bg-lime text-ink",
  muted: "bg-mist text-ink-3",
  cancelled: "bg-mist text-ink-3 line-through",
} as const;

export type PillTone = keyof typeof TONES;

/** Small rounded status badge. */
export function Pill({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: PillTone;
  className?: string;
}) {
  return (
    <span className={`inline-block rounded-pill px-2 py-0.5 text-xs font-medium ${TONES[tone]} ${className}`}>
      {children}
    </span>
  );
}
