import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? "salestraking-fallback-secret-change-me";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isAuthApi = pathname.startsWith("/api/auth");
  const isLoginPage = pathname === "/login";
  const isPublicHealth = pathname === "/api/health";

  if (isAuthApi || isPublicHealth) return NextResponse.next();

  const token = await getToken({ req, secret: authSecret });
  const isLoggedIn = Boolean(token);

  if (!isLoggedIn && isLoginPage) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const loginUrl = new URL("/login", req.nextUrl.origin);
    if (pathname !== "/") {
      loginUrl.searchParams.set("callbackUrl", `${pathname}${req.nextUrl.search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (isLoginPage) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"]
};
