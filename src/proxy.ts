import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Refresh the auth session so cookies stay fresh on every request.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: [
    // Skip all Next internals, static files, and generated icons and OG
    // images. Every match costs a Supabase session refresh, so this should
    // only run on real page requests.
    //
    // `_next` is excluded wholesale rather than just static/image: it also
    // covers the HMR socket in dev and the RSC internals, none of which have
    // a session to refresh and none of which should be passed through
    // NextResponse.next().
    "/((?!_next|favicon.ico|icon|apple-icon|opengraph-image|.*/opengraph-image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
