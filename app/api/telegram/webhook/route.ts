import { NextResponse } from "next/server";
import { handleTelegramWebhook } from "@/lib/telegram-bot";

export async function GET() {
  return NextResponse.json({ ok: true, message: "telegram webhook is alive" });
}

export async function POST(req: Request) {
  const update = (await req.json().catch(() => ({}))) as Parameters<typeof handleTelegramWebhook>[0];
  await handleTelegramWebhook(update);

  return NextResponse.json({ ok: true });
}
