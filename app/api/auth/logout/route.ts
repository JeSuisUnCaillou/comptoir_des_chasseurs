import { NextResponse, type NextRequest } from "next/server";
import { endSession } from "@/lib/auth/session";

export async function POST(request: NextRequest) {
  await endSession();
  return NextResponse.redirect(new URL("/connexion", request.url), 303);
}
