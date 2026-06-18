"use server";
import { redirect } from "next/navigation";
import { createDraftPO } from "@/lib/repos/purchasing";
import { setFlash } from "@/lib/flash";

export async function newOrder(): Promise<void> {
  const id = await createDraftPO();
  await setFlash("Orden de compra creada");
  redirect(`/admin/compras/${id}`);
}
