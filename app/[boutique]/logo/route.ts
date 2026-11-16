import { APP_LOGO } from "@/lib/logo";
import { shopLogo } from "@/lib/shop-logos";

/**
 * /<slug>/logo: the image a gérant uploaded for the shop, used as its logo
 * and the icon of the browser tab. Public, like any favicon. Its links carry
 * ?v=<version>, which changes with each upload, so it can be cached for good.
 */
export async function GET(request: Request, { params }: { params: Promise<{ boutique: string }> }) {
  const logo = await shopLogo((await params).boutique);
  if (!logo) return Response.redirect(new URL(APP_LOGO, request.url), 307);
  const versioned = new URL(request.url).searchParams.has("v");
  return new Response(new Uint8Array(logo.data), {
    headers: {
      "Content-Type": logo.contentType,
      "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "no-cache",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
