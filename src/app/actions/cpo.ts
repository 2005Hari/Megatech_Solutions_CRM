"use server"

import { revalidatePath } from "next/cache"
import { requireAuth } from "@/lib/session"
import { runAction, type ActionResult } from "@/lib/action-result"
import { requiredId } from "@/lib/validation"
import { deleteCpoCore } from "@/lib/delete-cores"

/**
 * Delete a customer PO. Untouched draft supplier POs raised from it are
 * removed with it; anything further along blocks the delete so purchasing
 * history is never silently destroyed.
 */
export async function deleteCPO(id: string): Promise<ActionResult> {
  return runAction(async () => {
    await requireAuth()
    requiredId(id, "Customer PO")

    await deleteCpoCore(id)

    revalidatePath("/")
    revalidatePath("/cpo")
    revalidatePath("/spo")
  })
}
