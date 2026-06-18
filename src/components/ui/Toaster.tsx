"use client";

import { useEffect, useState } from "react";

type Toast = { msg: string; tone: "ok" | "error" };

/** Renders a transient confirmation/error toast from the server-set flash cookie.
 *  Consumes (clears) the cookie on display so it shows once. The `flash` value
 *  carries a changing id, so repeated identical messages still re-trigger. */
export function Toaster({ flash }: { flash: string | null }) {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!flash) return;
    let t: Toast;
    try {
      const d = JSON.parse(flash) as { m: string; t?: "ok" | "error" };
      t = { msg: d.m, tone: d.t ?? "ok" };
    } catch {
      t = { msg: flash, tone: "ok" };
    }
    setToast(t);
    document.cookie = "admin_flash=; path=/; max-age=0";
    const timer = setTimeout(() => setToast(null), t.tone === "error" ? 4500 : 3200);
    return () => clearTimeout(timer);
  }, [flash]);

  if (!toast) return null;
  const isError = toast.tone === "error";
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60]">
      <div className="pointer-events-auto flex items-center gap-2 rounded-md border border-line bg-white px-4 py-3 text-sm font-medium text-ink shadow-2">
        <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-pill ${isError ? "bg-red-500 text-white" : "bg-lime text-ink"}`}>
          {isError ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </span>
        {toast.msg}
      </div>
    </div>
  );
}
