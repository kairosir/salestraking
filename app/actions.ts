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

function parseFlexibleNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;
  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
  const num = Number(normalized);
  return Number.isFinite(num) ? num : 0;
}

type SaleLineItem = {
  productName: string;
  productId: string | null;
  productLink: string | null;
  size: string | null;
  quantity: number;
  costPriceCny: number;
  salePrice: number;
};

function parseLineItems(raw: unknown): SaleLineItem[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const rawProductName = String(item.productName ?? "").trim();
        const rawProductId = normalizeOptionalString(item.productId);
        const rawProductLink = normalizeOptionalString(item.productLink);
        const rawSize = normalizeOptionalString(item.size);
        const quantity = Math.max(1, Math.floor(parseFlexibleNumber(item.quantity) || 1));
        const costPriceCny = Math.max(0, parseFlexibleNumber(item.costPriceCny));
        const salePrice = Math.max(0, parseFlexibleNumber(item.salePrice));
        return {
          productName: rawProductName || "Без товара",
          productId: rawProductId,
          productLink: rawProductLink,
          size: rawSize,
          quantity,
          costPriceCny,
          salePrice,
          hasMeaningfulData: Boolean(rawProductName || rawProductId || costPriceCny > 0 || salePrice > 0)
        };
      })
      .filter((item) => item.hasMeaningfulData)
      .map(({ hasMeaningfulData: _skip, ...item }) => item as SaleLineItem);
  } catch {
    return [];
  }
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

    const clientName = String(formData.get("clientName") ?? "").trim() || "Без имени";
    const clientPhone = String(formData.get("clientPhone") ?? "").trim();
    const paidTo = normalizeOptionalString(formData.get("paidTo"));
    const status = normalizeStatus(formData.get("status"));
    const orderDate = parseDate(normalizeOptionalDateString(formData.get("orderDate")));
    const paymentDate = parseDate(normalizeOptionalDateString(formData.get("paymentDate")));
    const screenshotDataRaw = normalizeOptionalString(formData.get("screenshotData")) ?? "";
    const lineItems = parseLineItems(formData.get("lineItems"));

    if (screenshotDataRaw !== "__KEEP__" && screenshotDataRaw.length > 1_500_000) {
      return { ok: false, error: "Скрин слишком большой. Выберите более легкий файл." };
    }

    const shared = {
      clientName,
      clientPhone,
      paidTo,
      orderDate,
      paymentDate,
      screenshotData: screenshotDataRaw && screenshotDataRaw !== "__KEEP__" ? screenshotDataRaw : null,
      status,
      createdById: session.user.id,
      updatedById: session.user.id
    };

    if (lineItems.length > 0) {
      await prisma.$transaction(
        lineItems.map((item) => {
          const costPrice = item.costPriceCny * CNY_TO_KZT;
          const margin = (item.salePrice - costPrice) * item.quantity * 0.95;
          return prisma.sale.create({
            data: {
              ...shared,
              productId: item.productId,
              productName: item.productName,
              productLink: item.productLink,
              size: item.size,
              quantity: item.quantity,
              costPriceCny: item.costPriceCny,
              costPrice,
              salePrice: item.salePrice,
              margin
            }
          });
        })
      );
    } else {
      const parsed = saleSchema.safeParse({
        productId: formData.get("productId"),
        clientName,
        clientPhone,
        productName: formData.get("productName"),
        productLink: formData.get("productLink"),
        paidTo,
        orderDate: formData.get("orderDate"),
        paymentDate: formData.get("paymentDate"),
        screenshotData: formData.get("screenshotData"),
        size: formData.get("size"),
        status,
        quantity: formData.get("quantity"),
        costPriceCny: formData.get("costPriceCny"),
        salePrice: formData.get("salePrice")
      });

      if (!parsed.success) {
        return { ok: false, error: parsed.error.issues[0]?.message ?? "Ошибка валидации" };
      }

      const data = parsed.data as Record<string, unknown>;
      const productName = String(data.productName ?? "").trim() || "Без товара";
      const productId = normalizeOptionalString(data.productId);
      const productLink = normalizeOptionalString(data.productLink);
      const size = normalizeOptionalString(data.size);
      const costPriceCny = Number(data.costPriceCny);
      const salePrice = Number(data.salePrice);
      const quantity = Math.max(1, Number(data.quantity) || 1);
      const costPrice = costPriceCny * CNY_TO_KZT;
      const margin = (salePrice - costPrice) * quantity * 0.95;

      await prisma.sale.create({
        data: {
          ...shared,
          productId,
          productName,
          productLink,
          size,
          quantity,
          costPriceCny,
          costPrice,
          salePrice,
          margin
        }
      });
    }

    revalidateSalesPages();
    return { ok: true };
  } catch (error) {
    console.error("createSaleAction failed:", error);
    return { ok: false, error: "Не удалось создать запись. Попробуйте еще раз." };
  }
}

export async function createScriptAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };

    const question = String(formData.get("question") ?? "").trim();
    const answer = String(formData.get("answer") ?? "").trim();
    if (!question && !answer) return { ok: false, error: "Заполните вопрос или ответ" };

    await prisma.scriptTemplate.create({
      data: {
        question: question || "Без вопроса",
        answer: answer || "",
        createdById: session.user.id,
        updatedById: session.user.id
      }
    });

    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    console.error("createScriptAction failed:", error);
    return { ok: false, error: "Не удалось добавить скрипт" };
  }
}

export async function updateScriptAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };

    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Не найден id скрипта" };

    const question = String(formData.get("question") ?? "").trim();
    const answer = String(formData.get("answer") ?? "").trim();

    await prisma.scriptTemplate.update({
      where: { id },
      data: {
        question: question || "Без вопроса",
        answer: answer || "",
        updatedById: session.user.id
      }
    });

    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    console.error("updateScriptAction failed:", error);
    return { ok: false, error: "Не удалось обновить скрипт" };
  }
}

export async function deleteScriptAction(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { ok: false, error: "Требуется авторизация" };

    const id = String(formData.get("id") ?? "");
    if (!id) return { ok: false, error: "Не найден id скрипта" };

    await prisma.scriptTemplate.delete({ where: { id } });
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    console.error("deleteScriptAction failed:", error);
    return { ok: false, error: "Не удалось удалить скрипт" };
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
