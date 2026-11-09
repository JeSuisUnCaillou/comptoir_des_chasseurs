import { NextResponse, type NextRequest } from "next/server";
import { upsertDiscordMember } from "@/lib/auth/members";
import { startSession } from "@/lib/auth/session";
import { testLoginEnabled } from "@/lib/auth/test-login";

export async function GET(request: NextRequest) {
  if (!testLoginEnabled()) return new NextResponse("Not found", { status: 404 });
  const name = request.nextUrl.searchParams.get("name") ?? "Testeur";
  const member = await upsertDiscordMember(`test-${name}`, name);
  await startSession(member.id);
  return NextResponse.redirect(new URL("/", request.url));
}
