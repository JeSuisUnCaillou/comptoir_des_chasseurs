import { NextResponse, type NextRequest } from "next/server";
import { PATH_HEADER } from "@/lib/auth/return-path";

// Tells server code which page is being visited, so a visitor sent to the
// login page can be brought back to it afterwards (see requireMember).
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/|favicon|icon|apple-icon|.*\\.(?:png|svg|ico|jpg|webp)$).*)"],
};
