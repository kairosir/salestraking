"use server";

import { revalidatePath } from "next/cache";
import { compare, hash } from "bcryptjs";
import { auth, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saleSchema } from "@/lib/sale-schema";
import type { SaleStatus } from "@prisma/client";

const CNY_TO_KZT = 80;

function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeOptionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeOptionalDateString(value: unknown) {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeStatus(value: unknown): SaleStatus {
  if (value === "DONE" || value === "TODO" || value === "WAITING") return value;
  return "WAITING";
}

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
      productId: formData.get("productId"),
      clientName: formData.get("clientName"),
      clientPhone: formData.get("clientPhone"),
      productName: formData.get("productName"),
      productLink: formData.get("productLink"),
      paidTo: formData.get("paidTo"),
      orderDate: formData.get("orderDate"),
      paymentDate: formData.get("paymentDate"),
      screenshotData: formData.get("screenshotData"),
      size: formData.get("size"),
      status: formData.get("status"),
      quantity: formData.get("quantity"),
      costPriceCny: formData.get("costPriceCny"),
      salePrice: formData.get("salePrice")
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка валидации" };
    }

    const data = parsed.data as Record<string, unknown>;

    const clientName = String(data.clientName ?? "").trim() || "Без имени";
    const clientPhone = String(data.clientPhone ?? "").trim();
    const productName = String(data.productName ?? "").trim() || "Без товара";
    const productId = normalizeOptionalString(data.productId);
    const productLink = normalizeOptionalString(data.productLink);
    const paidTo = normalizeOptionalString(data.paidTo);
    const size = normalizeOptionalString(data.size);
    const status = normalizeStatus(data.status);
    const orderDate = parseDate(normalizeOptionalDateString(data.orderDate));
    const paymentDate = parseDate(normalizeOptionalDateString(data.paymentDate));
    const screenshotDataRaw = normalizeOptionalString(data.screenshotData) ?? "";

    if (screenshotDataRaw.length > 1_500_000) {
      return { ok: false, error: "Скрин слишком большой. Выберите более легкий файл." };
    }

    const costPriceCny = Number(data.costPriceCny);
    const salePrice = Number(data.salePrice);
    const quantity = Math.max(1, Number(data.quantity) || 1);
    const costPrice = costPriceCny * CNY_TO_KZT;
    const margin = (salePrice - costPrice) * quantity * 0.95;

    await prisma.sale.create({
      data: {
        productId,
        clientName,
        clientPhone,
        productName,
        productLink,
        paidTo,
        orderDate,
        paymentDate,
        screenshotData: screenshotDataRaw || null,
        size,
        quantity,
        costPriceCny,
        costPrice,
        salePrice,
        margin,
        status,
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
      productId: formData.get("productId"),
      clientName: formData.get("clientName"),
      clientPhone: formData.get("clientPhone"),
      productName: formData.get("productName"),
      productLink: formData.get("productLink"),
      paidTo: formData.get("paidTo"),
      orderDate: formData.get("orderDate"),
      paymentDate: formData.get("paymentDate"),
      screenshotData: formData.get("screenshotData"),
      size: formData.get("size"),
      status: formData.get("status"),
      quantity: formData.get("quantity"),
      costPriceCny: formData.get("costPriceCny"),
      salePrice: formData.get("salePrice")
    });

    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка валидации" };
    }

    const data = parsed.data as Record<string, unknown>;

    const clientName = String(data.clientName ?? "").trim() || "Без имени";
    const clientPhone = String(data.clientPhone ?? "").trim();
    const productName = String(data.productName ?? "").trim() || "Без товара";
    const productId = normalizeOptionalString(data.productId);
    const productLink = normalizeOptionalString(data.productLink);
    const paidTo = normalizeOptionalString(data.paidTo);
    const size = normalizeOptionalString(data.size);
    const status = normalizeStatus(data.status);
    const orderDate = parseDate(normalizeOptionalDateString(data.orderDate));
    const paymentDate = parseDate(normalizeOptionalDateString(data.paymentDate));
    const screenshotDataRaw = normalizeOptionalString(data.screenshotData) ?? "";

    if (screenshotDataRaw.length > 1_500_000) {
      return { ok: false, error: "Скрин слишком большой. Выберите более легкий файл." };
    }

    const costPriceCny = Number(data.costPriceCny);
    const salePrice = Number(data.salePrice);
    const quantity = Math.max(1, Number(data.quantity) || 1);
    const costPrice = costPriceCny * CNY_TO_KZT;
    const margin = (salePrice - costPrice) * quantity * 0.95;

    await prisma.sale.update({
      where: { id },
      data: {
        productId,
        clientName,
        clientPhone,
        productName,
        productLink,
        paidTo,
        orderDate,
        paymentDate,
        screenshotData: screenshotDataRaw || null,
        size,
        quantity,
        costPriceCny,
        costPrice,
        salePrice,
        margin,
        status,
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
