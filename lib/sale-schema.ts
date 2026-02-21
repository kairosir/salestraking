import { z } from "zod";

export const saleSchema = z.object({
  clientName: z.string().trim().min(2, "Введите имя клиента"),
  clientPhone: z.string().trim().min(5, "Введите номер телефона"),
  productName: z.string().trim().min(2, "Введите товар"),
  productLink: z.string().trim().url("Неверная ссылка").optional().or(z.literal("")),
  size: z.string().trim().optional(),
  quantity: z.coerce.number().int().min(1, "Количество от 1"),
  costPrice: z.coerce.number().min(0, "Цена товара >= 0"),
  salePrice: z.coerce.number().min(0, "Цена продажи >= 0")
});

export type SaleInput = z.infer<typeof saleSchema>;
