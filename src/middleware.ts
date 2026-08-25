import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey } from "@/lib/supabase/keys";
import { apiError } from "@/lib/api/responses";
import { validateProductionConfiguration } from "@/lib/config/production";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = getSupabaseAnonKey();
  const pathname = request.nextUrl.pathname;
  const publicPage = pathname === "/sign-in" || pathname === "/auth/callback";
  const publicMachineEndpoint = pathname === "/api/health" || pathname === "/api/webhooks/fireflies" || pathname === "/api/webhooks/explee";

  if (process.env.NODE_ENV === "production" && !validateProductionConfiguration(process.env).valid && !publicPage && !publicMachineEndpoint) {
    if (pathname.startsWith("/api/")) return apiError("SERVICE_UNAVAILABLE", 503);
    return NextResponse.redirect(new URL("/sign-in?error=invalid_production_configuration", request.url));
  }

  if (!url || !key) {
    if (process.env.NODE_ENV === "production" && !publicPage && !publicMachineEndpoint) {
      if (pathname.startsWith("/api/")) return apiError("SERVICE_UNAVAILABLE", 503);
      return NextResponse.redirect(new URL("/sign-in?error=not_configured", request.url));
    }
    return response;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values) => {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const authenticated = Boolean(data?.claims);

  if (!authenticated && !publicPage && !publicMachineEndpoint) {
    if (pathname.startsWith("/api/")) return apiError("UNAUTHORIZED", 401);
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(signInUrl);
  }
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"] };
