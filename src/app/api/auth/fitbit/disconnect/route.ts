import { NextResponse } from "next/server";

import { getOrCreateSingleUser } from "@/lib/dashboard";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const user = await getOrCreateSingleUser();
  await prisma.fitbitAuth.deleteMany({ where: { userId: user.id } });
  return NextResponse.json({ success: true });
}
