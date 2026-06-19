"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function getCustomers() {
  return await prisma.customer.findMany({
    orderBy: { createdAt: "desc" },
  });
}

export async function createCustomer(formData: FormData) {
  const name = formData.get("name") as string;
  const contactDetails = formData.get("contactDetails") as string;

  if (!name) {
    return { error: "Name is required" };
  }

  await prisma.customer.create({
    data: {
      name,
      contactDetails,
    },
  });

  revalidatePath("/customers");
  redirect("/customers");
}

export async function deleteCustomer(id: string) {
  await prisma.customer.delete({
    where: { id },
  });
  
  revalidatePath("/customers");
}
