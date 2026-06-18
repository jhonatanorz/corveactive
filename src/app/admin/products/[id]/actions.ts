"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { validateProductInput } from "@/lib/admin/product-input";
import { createProduct, updateProduct, saveVariants, updateVariant, softDeleteProduct, addProductImage, deleteProductImage } from "@/lib/repos/products";
import { setFlash, withFlash } from "@/lib/flash";

export async function saveProduct(
  id: string,
  _prev: unknown,
  formData: FormData,
): Promise<{ errors: Record<string, string> } | void> {
  const raw = Object.fromEntries(
    ["name", "line", "type", "description", "price", "status"].map((k) => [
      k, String(formData.get(k) ?? ""),
    ]),
  );
  const result = validateProductInput(raw);
  if (!result.ok) return { errors: result.errors };

  if (id === "new") {
    const newId = await createProduct(result.value);
    await setFlash("Producto creado");
    redirect(`/admin/products/${newId}`);
  } else {
    await withFlash("Producto guardado", () => updateProduct(id, result.value));
    revalidatePath(`/admin/products/${id}`);
    revalidatePath("/admin/products");
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  await softDeleteProduct(productId);
  await setFlash("Producto eliminado");
  revalidatePath("/admin/products");
  revalidatePath("/");
  redirect("/admin/products");
}

export async function addVariant(productId: string, formData: FormData): Promise<void> {
  const color = String(formData.get("color") ?? "").trim();
  const color_hex = String(formData.get("color_hex") ?? "#000000");
  const size = String(formData.get("size") ?? "").trim();
  if (!color || !size) return;
  // New variants start empty; stock is set via a correction on /admin/inventory.
  await withFlash("Variante agregada", () =>
    saveVariants(productId, [{ color, color_hex, size, stock: 0 }]),
  );
  revalidatePath(`/admin/products/${productId}`);
}

export async function editVariant(productId: string, formData: FormData): Promise<void> {
  const variantId = String(formData.get("variantId") ?? "");
  const color = String(formData.get("color") ?? "").trim();
  const color_hex = String(formData.get("color_hex") ?? "#000000");
  const size = String(formData.get("size") ?? "").trim();
  if (!variantId || !color || !size) return;
  await withFlash("Variante actualizada", () =>
    updateVariant(variantId, { color, color_hex, size }),
  );
  revalidatePath(`/admin/products/${productId}`);
}

export async function uploadImage(productId: string, formData: FormData): Promise<void> {
  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) return;
  const color = String(formData.get("color") ?? "").trim() || null;
  await withFlash("Imagen subida", () => addProductImage(productId, file, color));
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  revalidatePath(`/producto/${productId}`);
}

export async function deleteImage(productId: string, formData: FormData): Promise<void> {
  const imageId = String(formData.get("imageId") ?? "");
  if (!imageId) return;
  await withFlash("Imagen eliminada", () => deleteProductImage(imageId));
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
  revalidatePath(`/producto/${productId}`);
}
