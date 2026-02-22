import { NextResponse } from "next/server";
import { sync17Track } from "@/lib/tracking-17track";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const manualSecret = process.env.NOTIFY_MANUAL_SECRET;
  const url = new URL(req.url);
  const querySecret = url.searchParams.get("secret");

  const hasCronAuth = Boolean(cronSecret && authHeader === `Bearer ${cronSecret}`);
  const hasManualAuth = Boolean(manualSecret && querySecret === manualSecret);

  if (!(hasCronAuth || hasManualAuth)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const result = await sync17Track();
  return NextResponse.json(result);
}
