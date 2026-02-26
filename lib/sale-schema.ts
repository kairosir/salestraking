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
  clientName: z.string().trim().optional().or(z.literal("")),
  clientPhone: z.string().trim().optional().or(z.literal("")),
  productName: z.string().trim().optional().or(z.literal("")),
  productLink: z.string().trim().optional().or(z.literal("")),
  paidTo: z.string().trim().max(200).optional().or(z.literal("")),
  orderComment: z.string().trim().max(1500).optional().or(z.literal("")),
  orderDate: optionalDateString,
  paymentDate: optionalDateString,
  screenshotData: z.string().optional().or(z.literal("")),
  receiptData: z.string().optional().or(z.literal("")),
  size: z.string().trim().optional().or(z.literal("")),
  color: z.string().trim().optional().or(z.literal("")),
  status: z.enum(["DONE", "TODO"]).optional().default("TODO"),
  orderStatus: z.enum(["DONE", "TODO"]).optional().default("TODO"),
  quantity: z.coerce.number().int().min(0).default(1),
  costPriceCny: decimalFromString.refine((v) => v >= 0, "Цена товара (юани) >= 0"),
  salePrice: decimalFromString.refine((v) => v >= 0, "Цена продажи >= 0")
});

export type SaleInput = z.infer<typeof saleSchema>;
