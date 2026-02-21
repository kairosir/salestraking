import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!id) return NextResponse.json({ screenshotData: null });

  const sale = await prisma.sale.findUnique({
    where: { id },
    select: { screenshotData: true }
  });

  return NextResponse.json({ screenshotData: sale?.screenshotData ?? null });
}
