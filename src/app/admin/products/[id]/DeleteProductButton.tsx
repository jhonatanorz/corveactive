"use client";

/** Soft-delete button with a confirm guard. The action is a bound server action. */
export function DeleteProductButton({ action }: { action: () => void | Promise<void> }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("¿Eliminar este producto? Dejará de mostrarse en la tienda (se puede recuperar).")) {
          e.preventDefault();
        }
      }}
    >
      <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
        Eliminar producto
      </button>
    </form>
  );
}
