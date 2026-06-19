"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getSuppliers() {
  return await prisma.supplier.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createSupplier(formData: FormData) {
  const name = formData.get("name") as string;
  const contactDetails = formData.get("contactDetails") as string;

  if (!name) {
    return { error: "Name is required" };
  }

  await prisma.supplier.create({
    data: {
      name,
      contactDetails,
    },
  });

  revalidatePath("/suppliers");
  redirect("/suppliers");
}

export async function deleteSupplier(id: string) {
  await prisma.supplier.delete({
    where: { id },
  });
  
  revalidatePath("/suppliers");
}
