import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    hasBotToken: Boolean(process.env.TELEGRAM_BOT_TOKEN),
    hasWebhookSecret: Boolean(process.env.TELEGRAM_WEBHOOK_SECRET)
  });
}
