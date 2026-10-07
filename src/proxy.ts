import { NextResponse, type NextRequest } from "next/server";

/**
 * Password-protects the whole site (pages and API) with HTTP Basic auth, so
 * the paid flight APIs behind it can't be used by anyone who finds the URL.
 *
 * Set SITE_PASSWORD (and optionally SITE_USERNAME) in the host's environment.
 * In production the site refuses to serve without a password, so a missing
 * setting can't silently make it public. Local `next dev` stays open.
 */

function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function credentials(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decoded = atob(header.slice(6));
    const i = decoded.indexOf(":");
    return i < 0 ? null : { user: decoded.slice(0, i), pass: decoded.slice(i + 1) };
  } catch {
    return null;
  }
}

export function proxy(request: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) {
    if (process.env.NODE_ENV !== "production") return NextResponse.next();
    return new NextResponse("SkyPlan is locked: set SITE_PASSWORD in the hosting environment.", {
      status: 503,
    });
  }

  const given = credentials(request);
  const username = process.env.SITE_USERNAME ?? "skyplan";
  if (given && safeEqual(given.user, username) && safeEqual(given.pass, password)) {
    return NextResponse.next();
  }
  return new NextResponse("Sign in to use SkyPlan.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SkyPlan", charset="UTF-8"' },
  });
}

export const config = {
  // Everything except build assets and public files.
  matcher: ["/((?!_next/static|_next/image|vendor/|favicon.ico).*)"],
};
