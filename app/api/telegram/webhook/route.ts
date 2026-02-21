import { NextResponse } from "next/server";
import { handleTelegramWebhook } from "@/lib/telegram-bot";

export async function POST(req: Request) {
  const secretPathToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  const tokenFromQuery = new URL(req.url).searchParams.get("secret");
  if (secretPathToken && tokenFromQuery !== secretPathToken) {
    return NextResponse.json({ ok: false, message: "forbidden" }, { status: 403 });
  }

  const update = (await req.json().catch(() => ({}))) as Parameters<typeof handleTelegramWebhook>[0];
  await handleTelegramWebhook(update);

  return NextResponse.json({ ok: true });
}
