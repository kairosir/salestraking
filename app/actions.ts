"use server";

import { revalidatePath } from "next/cache";
import { compare, hash } from "bcryptjs";
import { auth, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saleSchema } from "@/lib/sale-schema";

export async function loginWithCredentials(formData: FormData) {
  const login = String(formData.get("login") ?? "");
  const password = String(formData.get("password") ?? "");
  const callbackUrl = String(formData.get("callbackUrl") ?? "/");

  await signIn("credentials", {
    login,
    password,
    redirectTo: callbackUrl.startsWith("/") ? callbackUrl : "/"
  });
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

export async function changePasswordAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 8) throw new Error("Новый пароль должен быть минимум 8 символов");
  if (newPassword !== confirmPassword) throw new Error("Подтверждение пароля не совпадает");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true }
  });

  if (!user?.passwordHash) throw new Error("У пользователя не настроен пароль");

  const currentValid = await compare(currentPassword, user.passwordHash);
  if (!currentValid) throw new Error("Текущий пароль неверный");

  const newHash = await hash(newPassword, 10);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newHash }
  });

  revalidatePath("/account");
}

export async function createSaleAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };

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
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка валидации" };
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
    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    console.error("createSaleAction failed:", error);
    return { ok: false, error: "Не удалось создать запись. Попробуйте еще раз." };
  }
}

export async function updateSaleAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };

    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Не найден id записи" };

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
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка валидации" };
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
    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    console.error("updateSaleAction failed:", error);
    return { ok: false, error: "Не удалось обновить запись. Попробуйте еще раз." };
  }
}

export async function deleteSaleAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Unauthorized");

  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("Не найден id записи");

  await prisma.sale.delete({ where: { id } });
  revalidatePath("/");
  revalidatePath("/account");
}
