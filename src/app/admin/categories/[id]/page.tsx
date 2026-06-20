// src/app/admin/categories/[id]/page.tsx
import { notFound } from "next/navigation";
import { getCategory, countLiveProductsInCategory } from "@/lib/repos/categories";
import { saveCategory, deleteCategory } from "./actions";
import CategoryForm from "../CategoryForm";
import { DeleteCategoryButton } from "../DeleteCategoryButton";

export default async function CategoryEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = id === "new" ? null : await getCategory(id);
  if (id !== "new" && !existing) notFound();
  const liveCount = id === "new" ? 0 : await countLiveProductsInCategory(id);
  return (
    <div className="p-6">
      <CategoryForm category={existing} action={saveCategory.bind(null, id)} />
      {id !== "new" && (
        <div className="mt-6 max-w-md border-t border-line pt-4">
          <DeleteCategoryButton action={deleteCategory.bind(null, id)} count={liveCount} variant="link" />
        </div>
      )}
    </div>
  );
}
