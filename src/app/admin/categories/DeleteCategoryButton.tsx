"use client";

/** Delete control for a category. When the category still has live products it renders
 *  disabled (greyed) with a count note + tooltip; otherwise a confirm-guarded submit that
 *  posts the bound server action. `variant` picks the editor link vs. the compact list cell.
 *  stopPropagation keeps clicks from bubbling to a parent click-to-edit LinkRow. */
export function DeleteCategoryButton({
  action,
  count,
  variant,
}: {
  action: () => void | Promise<void>;
  count: number;
  variant: "link" | "icon";
}) {
  const note = `${count} ${count === 1 ? "producto" : "productos"}`;

  if (count > 0) {
    return (
      <span
        title={`No se puede eliminar: ${note} asociado${count === 1 ? "" : "s"}`}
        onClick={(e) => e.stopPropagation()}
        className="cursor-not-allowed text-xs text-ink-3"
      >
        {variant === "icon" ? note : `Eliminar categoría (${note})`}
      </span>
    );
  }

  return (
    <form
      action={action}
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar esta categoría? Esta acción no se puede deshacer.")) {
          e.preventDefault();
        }
      }}
    >
      <button
        type="submit"
        className={
          variant === "icon"
            ? "text-xs font-medium text-red-600 hover:underline"
            : "text-sm font-medium text-red-600 hover:underline"
        }
      >
        {variant === "icon" ? "Eliminar" : "Eliminar categoría"}
      </button>
    </form>
  );
}
