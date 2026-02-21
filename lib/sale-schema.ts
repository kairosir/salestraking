import { z } from "zod";

const decimalFromString = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");
    if (!normalized) return NaN;
    return Number(normalized);
  }
  return value;
}, z.number().finite());

const optionalDateString = z
  .string()
  .trim()
  .optional()
  .or(z.literal(""))
  .transform((value) => (value ? value : undefined));

export const saleSchema = z.object({
  productId: z.string().trim().max(120).optional().or(z.literal("")),
  clientName: z.string().trim().min(2, "Введите имя клиента"),
  clientPhone: z.string().trim().min(5, "Введите номер телефона"),
  productName: z.string().trim().min(2, "Введите товар"),
  productLink: z.string().trim().url("Неверная ссылка").optional().or(z.literal("")),
  paidTo: z.string().trim().max(200).optional().or(z.literal("")),
  orderDate: optionalDateString,
  paymentDate: optionalDateString,
  screenshotData: z.string().optional().or(z.literal("")),
  size: z.string().trim().optional().or(z.literal("")),
  quantity: z.coerce.number().int().min(1, "Количество от 1"),
  costPriceCny: decimalFromString.refine((v) => v >= 0, "Цена товара (юани) >= 0"),
  salePrice: decimalFromString.refine((v) => v >= 0, "Цена продажи >= 0")
});

export type SaleInput = z.infer<typeof saleSchema>;
