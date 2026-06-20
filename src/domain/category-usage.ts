// src/domain/category-usage.ts

/** Tally product rows into a categoryId → count map. Each row must carry category_id. */
export function tallyByCategory(rows: { category_id: string }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    out[r.category_id] = (out[r.category_id] ?? 0) + 1;
  }
  return out;
}

/** True when an error is a Postgres foreign-key violation (SQLSTATE 23503): a row in
 *  another table still references the one we tried to delete. Supabase surfaces this as
 *  a plain object with a `code` field. */
export function isForeignKeyViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: unknown }).code === "23503";
}
