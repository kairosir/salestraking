import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  let db: "ok" | "error" = "ok";

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }

  return NextResponse.json({
    status: db === "ok" ? "ok" : "partial",
    db,
    auth: {
      credentials: true
    }
  });
}
