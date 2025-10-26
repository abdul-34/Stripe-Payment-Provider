// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // If user goes to the root homepage `/`
  if (pathname === "/") {
    const url = req.nextUrl.clone();
    url.pathname = "/aimfox"; // redirect target
    return NextResponse.redirect(url);
  }

  // Otherwise continue normally
  return NextResponse.next();
}

// Apply middleware only to certain routes
export const config = {
  matcher: ["/"], // only trigger on homepage
};
