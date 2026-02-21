"use server";

import { revalidatePath } from "next/cache";
import { auth, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saleSchema } from "@/lib/sale-schema";

export async function loginWithCredentials(formData: FormData) {
  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");

  await signIn("credentials", {
    login,
    password,
    redirectTo: "/"
  });
}

export async function loginWithProvider(provider: "google" | "apple") {
  await signIn(provider, { redirectTo: "/" });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function createSaleAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const parsed = saleSchema.safeParse({
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    productName: formData.get("productName"),
    productLink: formData.get("productLink"),
    size: formData.get("size"),
    quantity: formData.get("quantity"),
    costPrice: formData.get("costPrice"),
    salePrice: formData.get("salePrice")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ошибка валидации");
  }

  const data = parsed.data;
  const margin = (data.salePrice - data.costPrice) * data.quantity;

  await prisma.sale.create({
    data: {
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      productName: data.productName,
      productLink: data.productLink || null,
      size: data.size || null,
      quantity: data.quantity,
      costPrice: data.costPrice,
      salePrice: data.salePrice,
      margin,
      createdById: session.user.id,
      updatedById: session.user.id
    }
  });

  revalidatePath("/");
}

export async function updateSaleAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Не найден id записи");

  const parsed = saleSchema.safeParse({
    clientName: formData.get("clientName"),
    clientPhone: formData.get("clientPhone"),
    productName: formData.get("productName"),
    productLink: formData.get("productLink"),
    size: formData.get("size"),
    quantity: formData.get("quantity"),
    costPrice: formData.get("costPrice"),
    salePrice: formData.get("salePrice")
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Ошибка валидации");
  }

  const data = parsed.data;
  const margin = (data.salePrice - data.costPrice) * data.quantity;

  await prisma.sale.update({
    where: { id },
    data: {
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      productName: data.productName,
      productLink: data.productLink || null,
      size: data.size || null,
      quantity: data.quantity,
      costPrice: data.costPrice,
      salePrice: data.salePrice,
      margin,
      updatedById: session.user.id
    }
  });

  revalidatePath("/");
}

export async function deleteSaleAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Не найден id записи");

  await prisma.sale.delete({ where: { id } });
  revalidatePath("/");
}
