"use server";

import { revalidatePath } from "next/cache";
import { compare, hash } from "bcryptjs";
import { auth, signIn, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saleSchema } from "@/lib/sale-schema";
import { runNotifications, runTestNotifications } from "@/lib/notifications";
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
  if (value === "DONE" || value === "TODO") return value;
  return "TODO";
}

function parseIds(raw: unknown) {
  if (typeof raw !== "string") return [];
  return raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function revalidateSalesPages() {
  revalidatePath("/");
  revalidatePath("/account");
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

    if (screenshotDataRaw !== "__KEEP__" && screenshotDataRaw.length > 1_500_000) {
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
        screenshotData: screenshotDataRaw && screenshotDataRaw !== "__KEEP__" ? screenshotDataRaw : null,
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

    revalidateSalesPages();
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

    if (screenshotDataRaw !== "__KEEP__" && screenshotDataRaw.length > 1_500_000) {
      return { ok: false, error: "Скрин слишком большой. Выберите более легкий файл." };
    }

    const costPriceCny = Number(data.costPriceCny);
    const salePrice = Number(data.salePrice);
    const quantity = Math.max(1, Number(data.quantity) || 1);
    const costPrice = costPriceCny * CNY_TO_KZT;
    const margin = (salePrice - costPrice) * quantity * 0.95;

    const updateData: Record<string, unknown> = {
      productId,
      clientName,
      clientPhone,
      productName,
      productLink,
      paidTo,
      orderDate,
      paymentDate,
      size,
      quantity,
      costPriceCny,
      costPrice,
      salePrice,
      margin,
      status,
      updatedById: session.user.id
    };

    if (screenshotDataRaw !== "__KEEP__") {
      updateData.screenshotData = screenshotDataRaw || null;
    }

    await prisma.sale.update({
      where: { id },
      data: updateData
    });

    revalidateSalesPages();
    return { ok: true };
  } catch (error) {
    console.error("updateSaleAction failed:", error);
    return { ok: false, error: "Не удалось обновить запись. Попробуйте еще раз." };
  }
}

export async function moveSaleToTrashAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };

  const id = String(formData.get("id") ?? "");
  if (!id) return { ok: false, error: "Не найден id записи" };

  await prisma.sale.update({
    where: { id },
    data: {
      status: "WAITING",
      updatedById: session.user.id
    }
  });
  revalidateSalesPages();
  return { ok: true };
}

export async function restoreSalesFromTrashAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };

  const ids = parseIds(formData.get("ids"));
  if (!ids.length) return { ok: false, error: "Не выбраны записи" };

  await prisma.sale.updateMany({
    where: { id: { in: ids }, status: "WAITING" },
    data: { status: "TODO", updatedById: session.user.id }
  });
  revalidateSalesPages();
  return { ok: true };
}

export async function clearTrashAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };

  const ids = parseIds(formData.get("ids"));

  if (!ids.length) {
    await prisma.sale.deleteMany({ where: { status: "WAITING" } });
  } else {
    await prisma.sale.deleteMany({ where: { id: { in: ids }, status: "WAITING" } });
  }

  revalidateSalesPages();
  return { ok: true };
}

export async function markSaleDoneAction(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };
    if (!id) return { ok: false, error: "Не найден id записи" };

    await prisma.sale.update({
      where: { id },
      data: {
        status: "DONE",
        updatedById: session.user.id
      }
    });

    revalidateSalesPages();
    return { ok: true };
  } catch (error) {
    console.error("markSaleDoneAction failed:", error);
    return { ok: false, error: "Не удалось отметить товар как выданный" };
  }
}

export async function addNotificationEmailAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };

    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (!email || !email.includes("@")) return { ok: false, error: "Введите корректный email" };

    await prisma.notificationRecipient.upsert({
      where: { email },
      update: {
        userId: session.user.id,
        emailEnabled: true,
        isActive: true
      },
      create: {
        userId: session.user.id,
        email,
        emailEnabled: true,
        telegramEnabled: false,
        isActive: true
      }
    });

    revalidatePath("/account");
    return { ok: true };
  } catch (error) {
    console.error("addNotificationEmailAction failed:", error);
    return { ok: false, error: "Не удалось добавить email" };
  }
}

export async function sendTestNotificationsAction(): Promise<{ ok: boolean; sent?: number; skipped?: number; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };
    const result = await runTestNotifications({ userId: session.user.id });
    return { ok: true, sent: result.sent, skipped: result.skipped };
  } catch (error) {
    console.error("sendTestNotificationsAction failed:", error);
    return { ok: false, error: "Не удалось отправить тестовые уведомления" };
  }
}

export async function sendTestNotificationsGlobalAction(): Promise<{ ok: boolean; sent?: number; skipped?: number; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };
    const result = await runTestNotifications();
    return { ok: true, sent: result.sent, skipped: result.skipped };
  } catch (error) {
    console.error("sendTestNotificationsGlobalAction failed:", error);
    return { ok: false, error: "Не удалось отправить общий тест" };
  }
}

export async function runNotificationsNowAction(): Promise<{ ok: boolean; sent?: number; skipped?: number; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };
    const result = await runNotifications({ userId: session.user.id, forceWeekly: true });
    return { ok: true, sent: result.sent, skipped: result.skipped };
  } catch (error) {
    console.error("runNotificationsNowAction failed:", error);
    return { ok: false, error: "Не удалось запустить рассылку" };
  }
}

export async function runNotificationsGlobalNowAction(): Promise<{ ok: boolean; sent?: number; skipped?: number; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };
    const result = await runNotifications({ forceWeekly: true });
    return { ok: true, sent: result.sent, skipped: result.skipped };
  } catch (error) {
    console.error("runNotificationsGlobalNowAction failed:", error);
    return { ok: false, error: "Не удалось запустить общую рассылку" };
  }
}
