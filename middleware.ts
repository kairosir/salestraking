import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;
  const isAuthApi = pathname.startsWith("/api/auth");
  const isLoginPage = pathname === "/login";

  if (isAuthApi) return NextResponse.next();

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isLoggedIn = Boolean(token);

  // Allow guests to open the login page.
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
